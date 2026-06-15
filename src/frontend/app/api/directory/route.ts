import { NextResponse } from 'next/server';
import { roDb } from '@database/connection';
import { getSession } from '@backend/auth/sessionManager';
import { sql } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const session = await getSession(request as any);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all users sorted by name using read-only DB pool
    const usersResult = await roDb.execute(sql`
      SELECT id, eid, name, email, role, designation_id, vertical_id, manager_id
      FROM users
      ORDER BY name ASC
    `);
    const users = usersResult.rows || usersResult;

    // Fetch structural metadata using read-only DB pool
    const metaResult = await roDb.execute(sql`
      SELECT id, type, name, parent_id, sort_order
      FROM structural_metadata
      ORDER BY type, name ASC
    `);
    const metadata = metaResult.rows || metaResult;

    return NextResponse.json({ users, metadata });
  } catch (error: any) {
    console.error('Directory API error:', error);
    return NextResponse.json({ error: error.message || 'Database error' }, { status: 500 });
  }
}
