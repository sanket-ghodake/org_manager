import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../../database/connection';
import { sql } from 'drizzle-orm';
import { getSession } from '../../../../../../backend/auth/sessionManager';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { appId, reason, scope, targetEntityId } = await request.json();

    if (!appId || !reason) {
      return NextResponse.json({ error: 'Missing appId or reason' }, { status: 400 });
    }

    const targetScope = scope || 'individual';

    // Insert access request
    const insertResult = await db.execute(sql`
      INSERT INTO forge_app_access_requests (
        app_id, 
        requester_id, 
        reason, 
        scope, 
        target_entity_id, 
        status
      ) VALUES (
        ${appId}, 
        ${session.id}, 
        ${reason}, 
        ${targetScope}, 
        ${targetEntityId || null}, 
        'pending_app_admin'
      ) RETURNING id
    `);

    const rows = (insertResult.rows || insertResult) as any[];
    const requestId = rows[0]?.id;

    return NextResponse.json({ success: true, requestId });
  } catch (error: any) {
    console.error('Request access API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
