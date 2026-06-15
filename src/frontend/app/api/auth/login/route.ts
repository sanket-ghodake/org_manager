import { NextResponse } from 'next/server';
import { logEvent } from '@backend/utils/logger';
import { authenticateUser } from '@backend/services/authService';

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

    // Authenticate using the service layer
    const authResult = await authenticateUser(email, password);
    if (!authResult.success) {
      await logEvent(null, 'User Login Failed', 'WARN', { email, reason: authResult.reason }, ipAddress);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const sessionPayload = authResult.user!;
    const jwtSession = authResult.token!;
    
    // Log successful login event
    await logEvent(sessionPayload.id, 'User Login', 'INFO', { email: sessionPayload.email, role: sessionPayload.role }, ipAddress);

    const response = NextResponse.json({ success: true, user: sessionPayload });
    response.cookies.set('session_token', jwtSession!, {
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

