import { NextRequest, NextResponse } from 'next/server';
import { db } from '@database/connection';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
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
    if (!scopes.includes('audit.log.write')) {
      return NextResponse.json({ error: 'Insufficient scopes (audit.log.write required)' }, { status: 403 });
    }

    // 2. Read request body
    const body = await request.json();
    const { action, severity = 'INFO', payload = {} } = body;

    if (!action || typeof action !== 'string' || action.trim() === '') {
      return NextResponse.json({ error: 'Action is required and must be a non-empty string' }, { status: 400 });
    }

    const validSeverities = ['INFO', 'WARN', 'ERROR', 'CRITICAL'];
    if (!validSeverities.includes(severity)) {
      return NextResponse.json({ error: 'Invalid severity level. Must be one of INFO, WARN, ERROR, CRITICAL' }, { status: 400 });
    }

    // 3. Extract IP address
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';

    // 4. Inject appId into log payload for accountability
    const enrichedPayload = {
      ...payload,
      appId: token.appId
    };

    // 5. Insert into system_logs
    const insertResult = await db.execute(sql`
      INSERT INTO system_logs (user_id, action, severity, payload, ip_address)
      VALUES (${token.userId}, ${action}, ${severity}, ${JSON.stringify(enrichedPayload)}::jsonb, ${ipAddress})
      RETURNING id
    `);
    const insertRows = insertResult.rows || insertResult;
    const logId = insertRows[0].id as string;

    return NextResponse.json({ success: true, logId });
  } catch (error: any) {
    console.error('Audit log API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
