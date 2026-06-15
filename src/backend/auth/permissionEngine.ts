import { db } from '@database/connection';
import { sql } from 'drizzle-orm';

/**
 * Resolves the complete set of permissions for a user based on the hierarchical RBAC roles.
 */
export async function resolveUserPermissions(userId: string): Promise<string[]> {
  try {
    // 1. Fetch user's direct role name to start hierarchy resolution
    const userResult = await db.execute(sql`
      SELECT role FROM users WHERE id = ${userId}
    `);
    const userRows = userResult.rows || userResult;
    if (!userRows || userRows.length === 0) {
      return [];
    }
    const roleName = userRows[0].role as string;

    // 2. Perform recursive CTE search down the roles tree to find all inherited roles
    const result = await db.execute(sql`
      WITH RECURSIVE role_hierarchy AS (
        -- Base Case: User's direct role
        SELECT id, name, parent_role_id
        FROM roles
        WHERE name = ${roleName}

        UNION ALL

        -- Recursive Step: Sub-roles (inheriting permissions downwards in the tree)
        SELECT r.id, r.name, r.parent_role_id
        FROM roles r
        INNER JOIN role_hierarchy rh ON r.parent_role_id = rh.id
      )
      SELECT DISTINCT p.action
      FROM role_hierarchy rh
      JOIN role_permissions rp ON rp.role_id = rh.id
      JOIN permissions p ON p.id = rp.permission_id
    `);

    const rows = result.rows || result;
    return rows.map((r: any) => r.action as string);
  } catch (error) {
    console.error('Error resolving user permissions:', error);
    return [];
  }
}

/**
 * Resolves the scopes/permissions allowed for an app running on behalf of a user.
 * It is the intersection of the app's declared scopes and the user's resolved permissions.
 */
export async function resolveAppPermissions(appId: string, userId: string): Promise<string[]> {
  try {
    // 1. Get app's registered scopes
    const appResult = await db.execute(sql`
      SELECT id, scopes FROM forge_apps WHERE id = ${appId} OR slug = ${appId}
    `);
    const appRows = appResult.rows || appResult;
    if (!appRows || appRows.length === 0) {
      return [];
    }
    const appScopes = (appRows[0].scopes || []) as string[];

    // 2. Get user permissions
    const userPermissions = await resolveUserPermissions(userId);

    // 3. Find intersection
    return appScopes.filter(scope => userPermissions.includes(scope));
  } catch (error) {
    console.error('Error resolving app permissions:', error);
    return [];
  }
}

/**
 * Validates if a user has a specific permission.
 */
export async function checkPermission(userId: string, permission: string): Promise<boolean> {
  const userPerms = await resolveUserPermissions(userId);
  return userPerms.includes(permission);
}

/**
 * Validates if an app has a specific permission on behalf of a user.
 */
export async function checkAppPermission(appId: string, userId: string, permission: string): Promise<boolean> {
  const appPerms = await resolveAppPermissions(appId, userId);
  return appPerms.includes(permission);
}

/**
 * Checks if a user has access to a specific application, enforcing Deny-Overrides-Grant logic
 * and falling back to default target rules when no explicit entitlements exist.
 */
export async function hasAppAccess(
  userId: string,
  appId: string,
  user?: { verticalId?: string; designationId?: string; designation?: string }
): Promise<boolean> {
  try {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    // Resolve app ID if it's a slug
    let resolvedAppId = appId;
    if (!uuidRegex.test(appId)) {
      const appLookup = await db.execute(sql`
        SELECT id FROM forge_apps WHERE slug = ${appId} LIMIT 1
      `);
      const lookupRows = (appLookup.rows || appLookup) as any[];
      if (!lookupRows || lookupRows.length === 0) {
        return false;
      }
      resolvedAppId = lookupRows[0].id as string;
    }

    // 1. If user ID is a valid UUID, evaluate explicit entitlements first
    if (uuidRegex.test(userId)) {
      const userContextResult = await db.execute(sql`
        SELECT 
          u.id AS "userId",
          u.designation_id AS "designationId",
          ARRAY_AGG(DISTINCT ut.team_id) FILTER (WHERE ut.team_id IS NOT NULL) AS "teamIds",
          ARRAY_AGG(DISTINCT pm.project_id) FILTER (WHERE pm.project_id IS NOT NULL) AS "projectIds",
          ARRAY_AGG(DISTINCT ug.group_id) FILTER (WHERE ug.group_id IS NOT NULL) AS "groupIds",
          ARRAY_AGG(DISTINCT uon.org_node_id) FILTER (WHERE uon.org_node_id IS NOT NULL) AS "orgNodeIds"
        FROM users u
        LEFT JOIN user_teams ut ON ut.user_id = u.id
        LEFT JOIN project_members pm ON pm.user_id = u.id
        LEFT JOIN user_groups ug ON ug.user_id = u.id
        LEFT JOIN user_org_nodes uon ON uon.user_id = u.id
        WHERE u.id = ${userId}
        GROUP BY u.id, u.designation_id
      `);

      const contextRows = userContextResult.rows || userContextResult;
      if (contextRows && contextRows.length > 0) {
        const context = contextRows[0] as any;
        const teamIds = (context.teamIds || []) as string[];
        const projectIds = (context.projectIds || []) as string[];
        const groupIds = (context.groupIds || []) as string[];
        const orgNodeIds = (context.orgNodeIds || []) as string[];
        const designationId = context.designationId as string;

        const entitlementsResult = await db.execute(sql`
          SELECT subject_type as "subjectType", subject_id as "subjectId", access_type as "accessType"
          FROM forge_app_entitlements
          WHERE app_id = ${resolvedAppId}
        `);

        const policies = (entitlementsResult.rows || entitlementsResult) as any[];

        const matchingPolicies = policies.filter(p => {
          const sId = p.subjectId;
          if (p.subjectType === 'user' && sId === userId) return true;
          if (p.subjectType === 'org_node' && (orgNodeIds.includes(sId) || teamIds.includes(sId))) return true;
          if (p.subjectType === 'project' && projectIds.includes(sId)) return true;
          if (p.subjectType === 'group' && groupIds.includes(sId)) return true;
          if (p.subjectType === 'designation' && sId === designationId) return true;
          return false;
        });

        if (matchingPolicies.some(p => p.accessType === 'deny')) {
          return false;
        }
        if (matchingPolicies.some(p => p.accessType === 'grant')) {
          return true;
        }
      }
    }

    // 2. Default Fallback to targetRules evaluation
    const appResult = await db.execute(sql`
      SELECT id, slug, is_enabled as "isEnabled", target_rules as "targetRules"
      FROM forge_apps
      WHERE id = ${resolvedAppId}
    `);
    const appRows = appResult.rows || appResult;
    if (!appRows || appRows.length === 0) {
      return false;
    }
    const app = appRows[0] as any;
    if (!app.isEnabled) {
      return false;
    }

    let uDetails = user;
    if (!uDetails && uuidRegex.test(userId)) {
      const userDetailsResult = await db.execute(sql`
        SELECT u.vertical_id as "verticalId", u.designation_id as "designationId", dm.name as designation
        FROM users u
        LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
        WHERE u.id = ${userId}
      `);
      const userDetailsRows = userDetailsResult.rows || userDetailsResult;
      if (userDetailsRows && userDetailsRows.length > 0) {
        uDetails = userDetailsRows[0] as any;
      }
    }

    if (!uDetails) {
      return false;
    }

    const rules = (app.targetRules || {}) as any;

    if (rules.verticals && rules.verticals.length > 0) {
      if (!rules.verticals.includes('all')) {
        const targetVerticals = rules.verticals.map((v: string) => {
          if (v === 'core-tech-uuid-placeholder') return '10000000-0000-0000-0000-000000000002';
          if (v === 'exec-uuid-placeholder') return '10000000-0000-0000-0000-000000000001';
          return v;
        });
        if (!targetVerticals.includes(uDetails.verticalId)) {
          return false;
        }
      }
    }

    if (rules.designations && rules.designations.length > 0) {
      if (!rules.designations.includes(uDetails.designationId)) {
        return false;
      }
    }

    const getJobLevelByName = (name: string): number => {
      const n = name.toLowerCase();
      if (n.includes('ceo')) return 5;
      if (n.includes('vp') || n.includes('cfo')) return 4;
      if (n.includes('manager')) return 3;
      if (n.includes('senior') || n.includes('sr')) return 2;
      return 1;
    };
    const userJobLevel = getJobLevelByName(uDetails.designation || 'Staff Member');
    const minJobLevel = rules.minJobLevel !== undefined ? Number(rules.minJobLevel) : 1;
    if (userJobLevel < minJobLevel) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error verifying app access:', error);
    return false;
  }
}


