// src/backend/middleware/authGuard.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from '@/backend/auth/sessionManager';

export async function middleware(request: NextRequest) {
  const session = await getSession(request);

  // If no active token exists, route back to primary entry portal
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Intercept user paths if password update requirement flag evaluates true
  if (session.isPasswordChanged === false && !request.nextUrl.pathname.startsWith('/force-reset')) {
    return NextResponse.redirect(new URL('/force-reset', request.url));
  }

  return NextResponse.next();
}
