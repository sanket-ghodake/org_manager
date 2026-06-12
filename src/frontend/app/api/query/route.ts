import { NextResponse } from 'next/server';
import { executeAdminQuery } from '../../../../backend/api/admin/queryEngine';
import { getSession } from '../../../../backend/auth/sessionManager';

export async function POST(request: Request) {
  // Check user session
  const session = await getSession(request as any);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
  }

  try {
    const { query } = await request.json();
    if (!query) {
      return NextResponse.json({ error: 'Query cannot be empty' }, { status: 400 });
    }

    // Execute the query using our query sandbox
    const result = await executeAdminQuery(query, session.role);
    
    // Express returns rows in the result property
    return NextResponse.json({ 
      rows: result.rows || result,
      rowCount: result.rowCount ?? (Array.isArray(result) ? result.length : 0),
      fields: result.fields ? result.fields.map((f: any) => f.name) : []
    });
  } catch (error: any) {
    console.error('SQL Execution failed:', error.message);
    return NextResponse.json({ error: error.message || 'Database error' }, { status: 500 });
  }
}
