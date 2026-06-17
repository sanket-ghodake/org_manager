import { NextRequest, NextResponse } from 'next/server';
import { db } from '@database/connection';
import { sql } from 'drizzle-orm';
import { getSession } from '@backend/auth/sessionManager';
import { verifyToken } from '@backend/auth/tokenVerifier';

export async function GET(request: NextRequest) {
  try {
    let isAuthorized = false;
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        await verifyToken(authHeader);
        isAuthorized = true;
      } catch (err: any) {
        // Fallback to session cookie
      }
    }

    if (!isAuthorized) {
      const session = await getSession(request);
      if (session) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ success: true, employees: [] });
    }

    const searchPattern = `%${query.trim()}%`;

    const searchResult = await db.execute(sql`
      SELECT 
        u.id, 
        u.eid, 
        u.name, 
        u.email, 
        u.role,
        dm.name as designation, 
        vm.name as "verticalName"
      FROM users u
      LEFT JOIN structural_metadata dm ON u.designation_id = dm.id
      LEFT JOIN structural_metadata vm ON u.vertical_id = vm.id
      WHERE u.name ILIKE ${searchPattern}
         OR u.email ILIKE ${searchPattern}
         OR u.eid ILIKE ${searchPattern}
      ORDER BY u.name ASC
      LIMIT 20
    `);

    const employees = (searchResult.rows || searchResult) as any[];

    return NextResponse.json({
      success: true,
      employees
    });
  } catch (error: any) {
    console.error('Org hierarchy search API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
