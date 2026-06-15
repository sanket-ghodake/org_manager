import { NextResponse } from 'next/server';
import { db } from '@database/connection';
import { users } from '@database/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { getSession, encryptSession } from '@backend/auth/sessionManager';
import { logEvent } from '@backend/utils/logger';

export async function POST(request: Request) {
  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
  
  try {
    // Verify session
    const session = await getSession(request as any);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    const { newPassword } = await request.json();

    if (!newPassword || newPassword.length < 8) {
      await logEvent(session.id, 'Password Reset Failed', 'WARN', { reason: 'Password length less than 8 characters' }, ipAddress);
      return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
    }

    // Hash the new password with bcryptjs
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update in database
    await db
      .update(users)
      .set({
        passwordHash,
        isPasswordChanged: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.id));

    // Update session payload
    const updatedSession = {
      ...session,
      isPasswordChanged: true,
    };

    // Encrypt/sign the updated session using JWT
    const jwtSession = await encryptSession(updatedSession);

    // Log the successful password reset event
    await logEvent(session.id, 'Password Changed', 'INFO', { email: session.email }, ipAddress);

    const response = NextResponse.json({ success: true, user: updatedSession });
    response.cookies.set('session_token', jwtSession, {
      path: '/',
      maxAge: 3600,
      sameSite: 'lax',
      httpOnly: true,
      secure: true,
    });

    return response;
  } catch (error: any) {
    console.error('Password reset error:', error);
    return NextResponse.json({ error: 'Internal server error during password reset' }, { status: 500 });
  }
}

