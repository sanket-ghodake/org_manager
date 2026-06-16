import { NextResponse } from 'next/server';
import { db } from '@database/connection';
import { users, structuralMetadata } from '@database/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { getSession } from '@backend/auth/sessionManager';
import { logEvent } from '@backend/utils/logger';

export async function POST(request: Request) {
  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
  
  try {
    // 1. Verify admin session
    const session = await getSession(request as any);
    if (!session || (session.role !== 'super_admin' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required' }, { status: 401 });
    }

    const { data } = await request.json();
    if (!Array.isArray(data)) {
      return NextResponse.json({ error: 'Invalid payload: Expected an array of rows' }, { status: 400 });
    }

    const defaultPasswordHash = await bcrypt.hash('password123', 10);
    const results = [];

    for (const row of data) {
      const { eid, name, email, role, designation, vertical, managerEid } = row;

      // Validate required fields
      if (!eid || !name || !email) {
        results.push({ eid, status: 'error', error: 'Missing EID, Name, or Email' });
        continue;
      }

      try {
        // Resolve Designation ID
        let designationId = null;
        if (designation) {
          const trimmedDes = designation.trim();
          const [existingDes] = await db
            .select()
            .from(structuralMetadata)
            .where(
              and(
                eq(structuralMetadata.type, 'job_level'),
                eq(structuralMetadata.name, trimmedDes)
              )
            )
            .limit(1);

          if (existingDes) {
            designationId = existingDes.id;
          } else {
            const [newDes] = await db
              .insert(structuralMetadata)
              .values({
                type: 'job_level',
                name: trimmedDes,
                sortOrder: 0,
              })
              .returning();
            designationId = newDes.id;
          }
        }

        // Resolve Vertical ID
        let verticalId = null;
        if (vertical) {
          const trimmedVert = vertical.trim();
          const [existingVert] = await db
            .select()
            .from(structuralMetadata)
            .where(
              and(
                eq(structuralMetadata.type, 'vertical'),
                eq(structuralMetadata.name, trimmedVert)
              )
            )
            .limit(1);

          if (existingVert) {
            verticalId = existingVert.id;
          } else {
            const [newVert] = await db
              .insert(structuralMetadata)
              .values({
                type: 'vertical',
                name: trimmedVert,
                sortOrder: 0,
              })
              .returning();
            verticalId = newVert.id;
          }
        }

        // Resolve Manager ID by Manager EID
        let managerId = null;
        if (managerEid) {
          const [managerUser] = await db
            .select()
            .from(users)
            .where(eq(users.eid, managerEid.trim()))
            .limit(1);
          if (managerUser) {
            managerId = managerUser.id;
          }
        }

        // Check if user already exists
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.eid, eid.trim()))
          .limit(1);

        if (existingUser) {
          // Update existing user
          await db
            .update(users)
            .set({
              name: name.trim(),
              email: email.toLowerCase().trim(),
              role: role ? role.trim() : existingUser.role,
              designationId: designationId || existingUser.designationId,
              verticalId: verticalId || existingUser.verticalId,
              managerId: managerId || existingUser.managerId,
              updatedAt: new Date(),
            })
            .where(eq(users.id, existingUser.id));
          
          results.push({ eid, status: 'updated' });
        } else {
          // Insert new user
          await db
            .insert(users)
            .values({
              eid: eid.trim(),
              name: name.trim(),
              email: email.toLowerCase().trim(),
              passwordHash: defaultPasswordHash,
              isPasswordChanged: false, // force password reset on first login
              role: role ? role.trim() : 'user',
              designationId,
              verticalId,
              managerId,
            });

          results.push({ eid, status: 'created' });
        }
      } catch (err: any) {
        results.push({ eid, status: 'error', error: err.message || 'Database execution error' });
      }
    }

    // Log the bulk ingestion event
    await logEvent(session.id, 'Bulk Ingest Processed', 'INFO', { count: data.length }, ipAddress);

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Bulk ingestion error:', error);
    return NextResponse.json({ error: 'Internal server error during bulk ingestion' }, { status: 500 });
  }
}
