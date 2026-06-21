import { NextRequest, NextResponse } from 'next/server';
import { db } from '@database/connection';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import { resolveAppPermissions } from '@backend/auth/permissionEngine';
import { parseDbTimestamp } from '@backend/utils/date';
import { SignJWT } from 'jose';
import { getKeys } from '@backend/auth/keyManager';
import { decryptText } from '@backend/utils/crypto';
import { isRateLimited } from '@backend/utils/rateLimiter';

export async function POST(request: NextRequest) {
  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';

  // Apply rate limiting: max 5 requests per minute per IP
  const rateLimit = isRateLimited(ipAddress, 'exchange', 5, 60000);
  if (rateLimit.limited) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const code = body.code || body.token;
    const clientId = body.client_id || body.clientId;
    const clientSecret = body.client_secret || body.clientSecret;

    if (!code) {
      return NextResponse.json({ error: 'Missing code' }, { status: 400 });
    }
    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Missing client credentials' }, { status: 400 });
    }

    // 1. Verify app credentials
    const appResult = await db.execute(sql`
      SELECT id, slug, client_id as "clientId", client_secret as "clientSecret" 
      FROM forge_apps 
      WHERE client_id = ${clientId}
    `);
    const appRows = appResult.rows || appResult;
    if (!appRows || appRows.length === 0) {
      return NextResponse.json({ error: 'Invalid client credentials' }, { status: 401 });
    }
    const app = appRows[0] as any;
    if (decryptText(app.clientSecret) !== clientSecret) {
      return NextResponse.json({ error: 'Invalid client credentials' }, { status: 401 });
    }

    // 2. Verify authorization code
    const codeResult = await db.execute(sql`
      SELECT id, code, app_id as "appId", user_id as "userId", expires_at as "expiresAt", used
      FROM forge_auth_codes
      WHERE code = ${code} AND app_id = ${app.id}
    `);
    const codeRows = codeResult.rows || codeResult;
    if (!codeRows || codeRows.length === 0) {
      return NextResponse.json({ error: 'Invalid authorization code' }, { status: 400 });
    }
    const authCode = codeRows[0] as any;

    if (authCode.used) {
      return NextResponse.json({ error: 'Authorization code already used' }, { status: 400 });
    }

    if (parseDbTimestamp(authCode.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Authorization code expired' }, { status: 400 });
    }

    // 3. Mark code as used
    await db.execute(sql`
      UPDATE forge_auth_codes SET used = true WHERE id = ${authCode.id}
    `);

    // 4. Fetch user profile
    const userResult = await db.execute(sql`
      SELECT id, eid, name, email, role FROM users WHERE id = ${authCode.userId}
    `);
    const userRows = userResult.rows || userResult;
    if (!userRows || userRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const user = userRows[0] as any;

    // Resolve intersection of app scopes and user permissions
    const authorizedScopes = await resolveAppPermissions(app.id, user.id);

    // 5. Generate signed JWT access token with 15-minute lifetime
    const { privateKey } = getKeys();
    const expiresIn = 900; // 15 minutes
    const accessToken = await new SignJWT({
      eid: user.eid,
      name: user.name,
      email: user.email,
      role: user.role,
      scopes: authorizedScopes,
      scope: authorizedScopes.join(' '),
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'forge-portal-key-1' })
      .setSubject(user.id)
      .setAudience(app.clientId || app.id)
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(privateKey);

    return NextResponse.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 900,
      user: {
        id: user.id,
        eid: user.eid,
        name: user.name,
        email: user.email,
        role: user.role
      },
      scopes: authorizedScopes
    });
  } catch (error: any) {
    console.error('Auth exchange error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
