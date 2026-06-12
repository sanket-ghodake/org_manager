// src/backend/middleware/authGuard.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from '../auth/sessionManager';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. Bypass authentication checks for login routes
  if (path === '/login' || path === '/api/auth/login') {
    return NextResponse.next();
  }

  const session = await getSession(request);

  // 2. If no active token exists, block and route back to login
  if (!session) {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 3. Enforce password reset guard
  if (session.isPasswordChanged === false) {
    // Allow access ONLY to force-reset pages/APIs and logs
    const isAllowedResetPath = path === '/force-reset' || 
                               path === '/api/auth/reset-password' || 
                               path === '/api/logs';

    if (!isAllowedResetPath) {
      // Dispatch alert warning log
      const logUrl = new URL('/api/logs', request.url);
      fetch(logUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': request.headers.get('cookie') || '',
        },
        body: JSON.stringify({
          action: 'Forced Password Reset Enforced',
          severity: 'WARN',
          payload: { email: session.email, interceptedPath: path },
        }),
      }).catch((err) => {
        console.error('Failed to dispatch middleware log:', err);
      });

      if (path.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forced password reset required' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/force-reset', request.url));
    }
  } else {
    // If password is already changed, prevent accessing force-reset page
    if (path === '/force-reset') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

