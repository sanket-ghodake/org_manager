import { CLIENT_ID, CLIENT_SECRET } from "../config";
import { db } from "../db/client";
import { getWorkingPortalUrl } from "./portal";

/**
 * Helper: Check recursively if User A (managerId) is an upline manager of User B (employeeId)
 */
export async function checkUplineManager(
  managerId: string,
  employeeId: string,
): Promise<boolean> {
  if (!managerId || !employeeId) return false;

  try {
    const workingUrl = await getWorkingPortalUrl();
    const targetUrl = `${workingUrl}/api/directory?checkManagerId=${encodeURIComponent(managerId)}&checkEmployeeId=${encodeURIComponent(employeeId)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "x-forge-client-id": CLIENT_ID,
        "x-forge-client-secret": CLIENT_SECRET,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = (await res.json()) as any;
      return !!data.isUpline;
    }
  } catch (_err: any) {
    // Fallback to local SQLite DB
  }

  // Fallback to local SQLite database query if portal is offline or unreachable
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
    console.error("Local fallback hierarchy check failed:", err);
    return false;
  }
}
