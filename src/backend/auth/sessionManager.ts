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
    // Decode base64 representation of session for demonstration purposes
    const decoded = JSON.parse(Buffer.from(tokenCookie.value, 'base64').toString('utf-8'));
    return decoded as UserSession;
  } catch (error) {
    console.error('Session decryption failed:', error);
    return null;
  }
}
