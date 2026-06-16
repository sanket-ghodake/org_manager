import { NextRequest, NextResponse } from 'next/server';
import { db } from '@database/connection';
import { sql } from 'drizzle-orm';
import { resolveUserPermissions } from '@backend/auth/permissionEngine';

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

    // 2. Resolve user's permissions
    const userPermissions = await resolveUserPermissions(token.userId);
    const authorizedScopes = (token.scope || []) as string[];

    return NextResponse.json({
      permissions: userPermissions,
      scopes: authorizedScopes
    });
  } catch (error: any) {
    console.error('Fetch permissions error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
