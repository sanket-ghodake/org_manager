import { NextRequest, NextResponse } from 'next/server';
import { db } from '@database/connection';
import { sql } from 'drizzle-orm';
import { getSession } from '@backend/auth/sessionManager';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectsResult = await db.execute(sql`
      SELECT id, name, code, description, status FROM projects ORDER BY name ASC
    `);
    const projects = (projectsResult.rows || projectsResult) as any[];

    return NextResponse.json({
      success: true,
      projects
    });
  } catch (error: any) {
    console.error('Projects API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
