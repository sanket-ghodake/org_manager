// src/backend/api/admin/queryEngine.ts
import { roDb } from '@database/connection';
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

  // Run the query against the read-only database pool
  const result = await roDb.execute(sql.raw(sqlInputStr));
  return result;
}

