import type { NextRequest } from 'next/server';

export interface UserSession {
  id: string;
  eid: string;
  email: string;
  name: string;
  role: string;
  isPasswordChanged: boolean;
}

export async function getSession(request: NextRequest): Promise<UserSession | null> {
  const tokenCookie = request.cookies.get('session_token');
  if (!tokenCookie) {
    return null;
  }

  try {
    // Cookie is base64url encoded - restore standard base64 before decoding
    const b64url = tokenCookie.value;
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '=='.slice(0, (4 - b64.length % 4) % 4);
    const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
    return decoded as UserSession;
  } catch (error) {
    console.error('Session decryption failed:', error);
    return null;
  }
}
