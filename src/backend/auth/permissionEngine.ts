import { db } from '../../database/connection';
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
