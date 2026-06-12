import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { middleware as authMiddleware } from '../backend/middleware/authGuard';

export async function middleware(request: NextRequest) {
  return authMiddleware(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static assets)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
