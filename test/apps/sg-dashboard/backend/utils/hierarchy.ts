import { db } from '../db/client';

/**
 * Helper: Check recursively if User A (managerId) is an upline manager of User B (employeeId)
 */
export async function checkUplineManager(managerId: string, employeeId: string): Promise<boolean> {
  if (!managerId || !employeeId) return false;
  try {
    const res = await db.execute({
      sql: `
        WITH RECURSIVE manager_chain AS (
          SELECT id, manager_id FROM users WHERE id = ?
          UNION ALL
          SELECT u.id, u.manager_id
          FROM users u
          JOIN manager_chain mc ON mc.manager_id = u.id
        )
        SELECT 1 FROM manager_chain WHERE manager_id = ? LIMIT 1
      `,
      args: [employeeId, managerId],
    });
    return res.rows.length > 0;
  } catch (err) {
    console.error('Hierarchy check failed:', err);
    return false;
  }
}
