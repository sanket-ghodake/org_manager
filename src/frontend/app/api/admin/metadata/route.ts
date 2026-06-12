import { NextResponse } from 'next/server';
import { db } from '../../../../../database/connection';
import { structuralMetadata } from '../../../../../database/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '../../../../../backend/auth/sessionManager';
import { logEvent } from '../../../../../backend/utils/logger';

export async function GET(request: Request) {
  try {
    const session = await getSession(request as any);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const metadata = await db
      .select()
      .from(structuralMetadata)
      .orderBy(structuralMetadata.sortOrder);

    return NextResponse.json({ metadata });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Database error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
  
  try {
    const session = await getSession(request as any);
    if (!session || (session.role !== 'super_admin' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, parentId, sortOrder, name, type } = body;

    if (id) {
      // Update metadata row
      await db
        .update(structuralMetadata)
        .set({
          parentId: parentId || null,
          sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
          name: name ? name.trim() : undefined,
          updatedAt: new Date(),
        })
        .where(eq(structuralMetadata.id, id));

      await logEvent(session.id, 'Metadata Updated', 'INFO', { id, name }, ipAddress);
      return NextResponse.json({ success: true });
    } else {
      // Create new metadata row
      if (!name || !type) {
        return NextResponse.json({ error: 'Missing name or type' }, { status: 400 });
      }

      const [newMeta] = await db
        .insert(structuralMetadata)
        .values({
          type: type.trim(),
          name: name.trim(),
          parentId: parentId || null,
          sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
        })
        .returning();

      await logEvent(session.id, 'Metadata Created', 'INFO', { id: newMeta.id, name: newMeta.name }, ipAddress);
      return NextResponse.json({ success: true, metadata: newMeta });
    }
  } catch (error: any) {
    console.error('Metadata API error:', error);
    return NextResponse.json({ error: error.message || 'Database error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
  
  try {
    const session = await getSession(request as any);
    if (!session || (session.role !== 'super_admin' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing ID param' }, { status: 400 });
    }

    await db
      .delete(structuralMetadata)
      .where(eq(structuralMetadata.id, id));

    await logEvent(session.id, 'Metadata Deleted', 'INFO', { id }, ipAddress);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Metadata delete error:', error);
    return NextResponse.json({ error: error.message || 'Database error' }, { status: 500 });
  }
}
