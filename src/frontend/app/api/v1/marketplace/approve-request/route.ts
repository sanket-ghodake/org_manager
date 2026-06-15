import { NextRequest, NextResponse } from 'next/server';
import { db } from '@database/connection';
import { sql } from 'drizzle-orm';
import { getSession } from '@backend/auth/sessionManager';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId, status, notes } = await request.json();

    if (!requestId || !status) {
      return NextResponse.json({ error: 'Missing requestId or status' }, { status: 400 });
    }

    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json({ error: 'Invalid status parameter' }, { status: 400 });
    }

    // 1. Fetch request details
    const requestResult = await db.execute(sql`
      SELECT 
        id, 
        app_id as "appId", 
        requester_id as "requesterId", 
        scope, 
        target_entity_id as "targetEntityId", 
        status
      FROM forge_app_access_requests
      WHERE id = ${requestId}
    `);
    const requestRows = (requestResult.rows || requestResult) as any[];
    if (!requestRows || requestRows.length === 0) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    const accessRequest = requestRows[0] as any;

    const appId = accessRequest.appId;
    const requesterId = accessRequest.requesterId;
    const scope = accessRequest.scope;
    const targetEntityId = accessRequest.targetEntityId;
    const currentStatus = accessRequest.status;

    // 2. Determine reviewer authorities
    const isSuperAdmin = session.role === 'super_admin';
    const appAdminRes = await db.execute(sql`
      SELECT 1 FROM forge_app_admins WHERE app_id = ${appId} AND user_id = ${session.id}
    `);
    const appAdminRows = (appAdminRes.rows || appAdminRes) as any[];
    const isAppAdmin = appAdminRows && appAdminRows.length > 0;

    if (!isSuperAdmin && !isAppAdmin) {
      return NextResponse.json({ error: 'Forbidden: You are not authorized to review this request' }, { status: 403 });
    }

    // 3. Process Review state transitions
    let nextStatus = currentStatus;
    let provisionEntitlement = false;

    if (isSuperAdmin) {
      // Super Admin can override or approve any request at pending_app_admin or pending_super_admin
      if (status === 'rejected') {
        nextStatus = 'rejected';
      } else {
        nextStatus = 'approved';
        provisionEntitlement = true;
      }
    } else {
      // App Admin review
      if (currentStatus !== 'pending_app_admin') {
        return NextResponse.json({ error: 'Request is not pending App Admin review' }, { status: 400 });
      }

      if (status === 'rejected') {
        nextStatus = 'rejected';
      } else {
        if (scope === 'individual') {
          nextStatus = 'approved';
          provisionEntitlement = true;
        } else {
          // Elevated scopes require Super Admin signoff
          nextStatus = 'pending_super_admin';
        }
      }
    }

    // 4. Update request & provision in a transaction
    await db.transaction(async (tx) => {
      if (isSuperAdmin) {
        await tx.execute(sql`
          UPDATE forge_app_access_requests
          SET 
            status = ${nextStatus},
            super_admin_reviewed_by = ${session.id},
            super_admin_notes = ${notes || null},
            updated_at = NOW()
          WHERE id = ${requestId}
        `);
      } else {
        await tx.execute(sql`
          UPDATE forge_app_access_requests
          SET 
            status = ${nextStatus},
            app_admin_reviewed_by = ${session.id},
            app_admin_notes = ${notes || null},
            updated_at = NOW()
          WHERE id = ${requestId}
        `);
      }

      if (provisionEntitlement) {
        const subjectType = scope === 'individual' ? 'user' :
                            scope === 'org_node' ? 'org_node' : 'project';
        
        const subjectId = scope === 'individual' ? requesterId : targetEntityId;

        if (!subjectId) {
          throw new Error('Missing target subject ID for provisioning elevated scope.');
        }

        // Insert into entitlements table
        await tx.execute(sql`
          INSERT INTO forge_app_entitlements (app_id, subject_type, subject_id, access_type, granted_by)
          VALUES (${appId}, ${subjectType}, ${subjectId}, 'grant', ${session.id})
        `);
      }
    });

    return NextResponse.json({ success: true, nextStatus });
  } catch (error: any) {
    console.error('Approve access request error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
