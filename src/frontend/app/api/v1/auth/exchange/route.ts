import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../../database/connection';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import { resolveAppPermissions } from '../../../../../../backend/auth/permissionEngine';

export async function POST(request: NextRequest) {
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
    if (app.clientSecret !== clientSecret) {
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

    if (new Date(authCode.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Authorization code expired' }, { status: 400 });
    }

    // 3. Mark code as used
    await db.execute(sql`
      UPDATE forge_auth_codes SET used = true WHERE id = ${authCode.id}
    `);

    // 4. Generate access token
    const accessToken = 'access_token_' + crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // 5. Fetch user profile
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

    // 6. Save access token
    await db.execute(sql`
      INSERT INTO forge_access_tokens (access_token, app_id, user_id, expires_at, scope)
      VALUES (${accessToken}, ${app.id}, ${user.id}, ${expiresAt.toISOString()}, ${JSON.stringify(authorizedScopes)}::jsonb)
    `);

    return NextResponse.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
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
