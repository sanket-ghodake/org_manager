import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../../database/connection';
import { sql } from 'drizzle-orm';
import { getSession } from '../../../../../../backend/auth/sessionManager';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';

    let query;
    if (session.role === 'super_admin') {
      query = sql`
        SELECT 
          r.id, 
          r.app_id as "appId", 
          a.name as "appName", 
          r.requester_id as "requesterId", 
          u.name as "requesterName", 
          r.reason, 
          r.scope, 
          r.target_entity_id as "targetEntityId", 
          r.status, 
          r.created_at as "createdAt"
        FROM forge_app_access_requests r
        INNER JOIN forge_apps a ON r.app_id = a.id
        INNER JOIN users u ON r.requester_id = u.id
        WHERE (${filter} != 'pending' OR r.status IN ('pending_app_admin', 'pending_super_admin'))
        ORDER BY r.created_at DESC
      `;
    } else {
      const adminAppsRes = await db.execute(sql`
        SELECT app_id FROM forge_app_admins WHERE user_id = ${session.id}
      `);
      const adminAppsRows = (adminAppsRes.rows || adminAppsRes) as any[];
      const adminAppIds = (adminAppsRows || []).map((row: any) => row.app_id);

      if (adminAppIds.length > 0) {
        query = sql`
          SELECT 
            r.id, 
            r.app_id as "appId", 
            a.name as "appName", 
            r.requester_id as "requesterId", 
            u.name as "requesterName", 
            r.reason, 
            r.scope, 
            r.target_entity_id as "targetEntityId", 
            r.status, 
            r.created_at as "createdAt"
          FROM forge_app_access_requests r
          INNER JOIN forge_apps a ON r.app_id = a.id
          INNER JOIN users u ON r.requester_id = u.id
          WHERE (r.requester_id = ${session.id} OR r.app_id = ANY(${adminAppIds}))
            AND (${filter} != 'pending' OR r.status IN ('pending_app_admin', 'pending_super_admin'))
          ORDER BY r.created_at DESC
        `;
      } else {
        query = sql`
          SELECT 
            r.id, 
            r.app_id as "appId", 
            a.name as "appName", 
            r.requester_id as "requesterId", 
            u.name as "requesterName", 
            r.reason, 
            r.scope, 
            r.target_entity_id as "targetEntityId", 
            r.status, 
            r.created_at as "createdAt"
          FROM forge_app_access_requests r
          INNER JOIN forge_apps a ON r.app_id = a.id
          INNER JOIN users u ON r.requester_id = u.id
          WHERE r.requester_id = ${session.id}
            AND (${filter} != 'pending' OR r.status IN ('pending_app_admin', 'pending_super_admin'))
          ORDER BY r.created_at DESC
        `;
      }
    }

    const result = await db.execute(query);
    const requests = result.rows || result;

    return NextResponse.json({ requests });
  } catch (error: any) {
    console.error('Fetch access requests error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
