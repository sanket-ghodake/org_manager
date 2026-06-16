import { NextRequest, NextResponse } from 'next/server';
import { db } from '@database/connection';
import { sql } from 'drizzle-orm';
import { getHierarchyLevel } from '@backend/api/user/portal';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }
    const tokenStr = authHeader.substring(7);

    // 1. Resolve access token
    const tokenResult = await db.execute(sql`
      SELECT id, access_token as "accessToken", app_id as "appId", user_id as "userId", expires_at as "expiresAt", scope
      FROM forge_access_tokens
      WHERE access_token = ${tokenStr}
    `);
    const tokenRows = tokenResult.rows || tokenResult;
    if (!tokenRows || tokenRows.length === 0) {
      return NextResponse.json({ error: 'Invalid access token' }, { status: 401 });
    }
    const token = tokenRows[0] as any;

    if (new Date(token.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Access token expired' }, { status: 401 });
    }

    const scopes = (token.scope || []) as string[];
    if (!scopes.includes('user.profile.read')) {
      return NextResponse.json({ error: 'Insufficient scopes (user.profile.read required)' }, { status: 403 });
    }

    // 2. Fetch user information
    const userResult = await db.execute(sql`
      SELECT 
        u.id, 
        u.eid, 
        u.name, 
        u.email, 
        u.role, 
        u.manager_id as "managerId",
        dm.name as designation, 
        vm.name as "verticalName"
      FROM users u
      LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
      LEFT JOIN structural_metadata vm ON u.vertical_id = vm.id
      WHERE u.id = ${token.userId}
    `);
    const userRows = userResult.rows || userResult;
    if (!userRows || userRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const rawUser = userRows[0] as any;
    const hierarchyLevel = await getHierarchyLevel(token.userId);

    const userProfile: any = {
      id: rawUser.id,
      eid: rawUser.eid,
      name: rawUser.name,
      email: rawUser.email,
      role: rawUser.role,
      designation: rawUser.designation || 'Staff Member',
      verticalName: rawUser.verticalName || 'Corporate',
      hierarchyLevel
    };

    // Include manager details only if user.manager.read scope is present
    if (scopes.includes('user.manager.read') && rawUser.managerId) {
      const managerResult = await db.execute(sql`
        SELECT 
          u.id, 
          u.eid, 
          u.name, 
          u.email, 
          dm.name as designation
        FROM users u
        LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
        WHERE u.id = ${rawUser.managerId}
      `);
      const managerRows = managerResult.rows || managerResult;
      if (managerRows && managerRows.length > 0) {
        const mgr = managerRows[0] as any;
        userProfile.manager = {
          id: mgr.id,
          eid: mgr.eid,
          name: mgr.name,
          email: mgr.email,
          designation: mgr.designation || 'Executive'
        };
      } else {
        userProfile.manager = null;
      }
    }

    return NextResponse.json({ user: userProfile });
  } catch (error: any) {
    console.error('Fetch user details error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
