// src/backend/api/admin/queryEngine.ts
import { db } from '../../../database/connection';
import { sql } from 'drizzle-orm';

export async function executeAdminQuery(sqlInputStr: string, adminRole: string) {
  // Hard execution block for read-only administration profiles and standard users
  if (adminRole === 'read_only_admin' || adminRole === 'user') {
    const destructiveKeywords = ['drop', 'delete', 'truncate', 'update', 'insert', 'alter'];
    const isDestructive = destructiveKeywords.some(keyword => 
      sqlInputStr.toLowerCase().includes(keyword)
    );
    
    if (isDestructive) {
      throw new Error("Privilege Violation: Read-only accounts cannot run destructive queries.");
    }
  }

  // Run the sanitized query statement against the target database
  const result = await db.execute(sql.raw(sqlInputStr));
  return result;
}
