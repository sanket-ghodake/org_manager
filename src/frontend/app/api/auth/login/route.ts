import { NextResponse } from 'next/server';
import { db } from '../../../../../database/connection';
import { users } from '../../../../../database/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { logEvent } from '../../../../../backend/utils/logger';
import { encryptSession } from '../../../../../backend/auth/sessionManager';

export async function POST(request: Request) {
  let email = '';
  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';

  try {
    const { email: rawEmail, password } = await request.json();
    email = rawEmail || '';

    if (!email || !password) {
      await logEvent(null, 'User Login Failed', 'WARN', { email, reason: 'Missing email or password' }, ipAddress);
      return NextResponse.json({ error: 'Please enter both email and password' }, { status: 400 });
    }

    // Lookup user in database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      await logEvent(null, 'User Login Failed', 'WARN', { email, reason: 'User not found' }, ipAddress);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Verify password hash using bcryptjs verification
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await logEvent(null, 'User Login Failed', 'WARN', { email, reason: 'Password invalid' }, ipAddress);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Construct session payload
    const sessionPayload = {
      id: user.id,
      eid: user.eid,
      email: user.email,
      name: user.name,
      role: user.role,
      isPasswordChanged: user.isPasswordChanged,
    };

    // Encrypt/sign the session using JWT
    const jwtSession = await encryptSession(sessionPayload);
    
    // Log successful login event
    await logEvent(user.id, 'User Login', 'INFO', { email: user.email, role: user.role }, ipAddress);

    const response = NextResponse.json({ success: true, user: sessionPayload });
    response.cookies.set('session_token', jwtSession, {
      path: '/',
      maxAge: 3600,
      sameSite: 'lax',
      httpOnly: true,
      secure: true,
    });

    return response;
  } catch (error: any) {
    console.error('Authentication error:', error);
    await logEvent(null, 'User Login Exception', 'ERROR', { email, error: error.message }, ipAddress);
    return NextResponse.json({ error: 'Internal server error during authentication' }, { status: 500 });
  }
}

