import { db } from '../../database/connection';
import { users } from '../../database/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { encryptSession } from '../auth/sessionManager';

export async function authenticateUser(email: string, password: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);

  if (!user) {
    return { success: false, reason: 'User not found' };
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return { success: false, reason: 'Password invalid' };
  }

  const sessionPayload = {
    id: user.id,
    eid: user.eid,
    email: user.email,
    name: user.name,
    role: user.role,
    isPasswordChanged: user.isPasswordChanged,
  };

  const token = await encryptSession(sessionPayload);

  return {
    success: true,
    user: sessionPayload,
    token
  };
}
