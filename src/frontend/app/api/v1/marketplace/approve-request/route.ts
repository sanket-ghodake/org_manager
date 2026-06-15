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
        r.id, 
        r.app_id as "appId", 
        r.requester_id as "requesterId", 
        u.manager_id as "managerId",
        r.scope, 
        r.target_entity_id as "targetEntityId", 
        r.status
      FROM forge_app_access_requests r
      INNER JOIN users u ON r.requester_id = u.id
      WHERE r.id = ${requestId}
    `);
    const requestRows = (requestResult.rows || requestResult) as any[];
    if (!requestRows || requestRows.length === 0) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    const accessRequest = requestRows[0] as any;

    const appId = accessRequest.appId;
    const scope = accessRequest.scope;
    const currentStatus = accessRequest.status;

    if (session.id === accessRequest.requesterId) {
      return NextResponse.json({ error: 'Forbidden: You cannot review your own access request.' }, { status: 403 });
    }

    // 2. Determine reviewer authorities
    const isSuperAdmin = session.role === 'super_admin';
    const isRequesterManager = session.id === accessRequest.managerId;
    const appAdminRes = await db.execute(sql`
      SELECT 1 FROM forge_app_admins WHERE app_id = ${appId} AND user_id = ${session.id}
    `);
    const appAdminRows = (appAdminRes.rows || appAdminRes) as any[];
    const isAppAdmin = appAdminRows && appAdminRows.length > 0;

    let isAuthorized = false;
    if (currentStatus === 'pending_manager') {
      isAuthorized = isRequesterManager || isSuperAdmin;
    } else if (currentStatus === 'pending_app_admin') {
      isAuthorized = isAppAdmin || isSuperAdmin;
    } else if (currentStatus === 'pending_super_admin') {
      isAuthorized = isSuperAdmin;
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden: You are not authorized to review this request at its current stage' }, { status: 403 });
    }

    // 3. Process Review state transitions
    let nextStatus = currentStatus;
    if (status === 'rejected') {
      nextStatus = 'rejected';
    } else {
      if (isSuperAdmin) {
        nextStatus = 'approved';
      } else {
        if (currentStatus === 'pending_manager') {
          nextStatus = 'pending_app_admin';
        } else if (currentStatus === 'pending_app_admin') {
          if (scope === 'individual') {
            nextStatus = 'approved';
          } else {
            // Elevated scopes require Super Admin signoff
            nextStatus = 'pending_super_admin';
          }
        } else if (currentStatus === 'pending_super_admin') {
          nextStatus = 'approved';
        }
      }
    }

    // 4. Update request status and log messages (including automatic entitlement provisioning)
    await db.transaction(async (tx) => {
      if (currentStatus === 'pending_manager') {
        await tx.execute(sql`
          UPDATE forge_app_access_requests
          SET 
            status = ${nextStatus},
            manager_reviewed_by = ${session.id},
            manager_notes = ${notes || null},
            updated_at = NOW()
          WHERE id = ${requestId}
        `);
      } else if (currentStatus === 'pending_app_admin') {
        await tx.execute(sql`
          UPDATE forge_app_access_requests
          SET 
            status = ${nextStatus},
            app_admin_reviewed_by = ${session.id},
            app_admin_notes = ${notes || null},
            updated_at = NOW()
          WHERE id = ${requestId}
        `);
      } else if (currentStatus === 'pending_super_admin') {
        await tx.execute(sql`
          UPDATE forge_app_access_requests
          SET 
            status = ${nextStatus},
            super_admin_reviewed_by = ${session.id},
            super_admin_notes = ${notes || null},
            updated_at = NOW()
          WHERE id = ${requestId}
        `);
      }

      // Insert system logging message into discussion timeline
      const systemMessage = status === 'rejected'
        ? `🚨 Request rejected by ${session.name} (${session.role === 'super_admin' ? 'Super Admin' : (isAppAdmin ? 'App Admin' : 'Manager')}). Feedback: "${notes || 'No review notes provided.'}"`
        : `✅ Request approved by ${session.name} (${session.role === 'super_admin' ? 'Super Admin' : (isAppAdmin ? 'App Admin' : 'Manager')}). Transitioned status to: ${nextStatus}. Notes: "${notes || 'No notes provided.'}"`;

      await tx.execute(sql`
        INSERT INTO forge_app_access_request_messages (request_id, sender_id, message)
        VALUES (${requestId}, ${session.id}, ${systemMessage})
      `);

      // Provision entitlements automatically when the request hits 'approved'
      if (nextStatus === 'approved') {
        const subjectType = scope === 'individual' ? 'user' : (scope === 'org_node' ? 'org_node' : 'project');
        const subjectId = scope === 'individual' ? accessRequest.requesterId : accessRequest.targetEntityId;

        if (subjectId) {
          // Verify to prevent duplicate active grants
          const checkEnt = await tx.execute(sql`
            SELECT 1 FROM forge_app_entitlements 
            WHERE app_id = ${appId} AND subject_type = ${subjectType} AND subject_id = ${subjectId} AND access_type = 'grant'
          `);
          const checkRows = checkEnt.rows || checkEnt;
          if (!checkRows || checkRows.length === 0) {
            await tx.execute(sql`
              INSERT INTO forge_app_entitlements (app_id, subject_type, subject_id, access_type, granted_by)
              VALUES (${appId}, ${subjectType}, ${subjectId}, 'grant', ${session.id})
            `);
          }
        }
      }
    });

    return NextResponse.json({ success: true, nextStatus });
  } catch (error: any) {
    console.error('Approve access request error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
