// src/backend/middleware/authGuard.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from '../auth/sessionManager';
import { logEvent } from '../utils/logger';

export async function middleware(request: any) {
  const session = await getSession(request);
  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';

  // If no active token exists, route back to primary entry portal
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Intercept user paths if password update requirement flag evaluates true
  if (session.isPasswordChanged === false && !request.nextUrl.pathname.startsWith('/force-reset')) {
    await logEvent(
      session.id,
      'Forced Password Reset Enforced',
      'WARN',
      { email: session.email, interceptedPath: request.nextUrl.pathname },
      ipAddress
    );
    return NextResponse.redirect(new URL('/force-reset', request.url));
  }

  return NextResponse.next();
}
