import { SignJWT, jwtVerify } from 'jose';

export interface UserSession {
  id: string;
  eid: string;
  email: string;
  name: string;
  role: string;
  isPasswordChanged: boolean;
}
const isProduction = process.env.NODE_ENV === 'production';
if (!process.env.JWT_SECRET && isProduction) {
  throw new Error("FATAL: JWT_SECRET environment variable is missing in production environment!");
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-super-secret-key-that-is-at-least-32-characters-long'
);

export async function encryptSession(session: UserSession): Promise<string> {
  return await new SignJWT({ ...session })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

export async function decryptSession(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    });
    return payload as unknown as UserSession;
  } catch (error: any) {
    return null;
  }
}

export async function getSession(request: any): Promise<UserSession | null> {
  const tokenCookie = request.cookies.get('session_token');
  if (!tokenCookie) {
    return null;
  }

  try {
    return await decryptSession(tokenCookie.value);
  } catch (error: any) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Session decryption failed:', error.message || error);
    }
    return null;
  }
}

