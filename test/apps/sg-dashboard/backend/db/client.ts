import { createClient } from '@libsql/client';
import { DATABASE_URL } from '../config';

export const db = createClient({
  url: DATABASE_URL,
});

export async function initDb() {
  try {
    // Enable foreign key constraint enforcement
    await db.execute(`PRAGMA foreign_keys = ON;`);
    // Check if the old schema with manager_id foreign key exists
    const fkCheck = await db.execute(`PRAGMA foreign_key_list(users)`);
    const hasManagerFk = fkCheck.rows?.some(
      (row: any) => row.from === 'manager_id'
    );

    if (hasManagerFk) {
      console.log('Recreating tables to remove manager_id foreign key constraint...');
      await db.execute(`DROP TABLE IF EXISTS submission_requests`);
      await db.execute(`DROP TABLE IF EXISTS dashboard_items`);
      await db.execute(`DROP TABLE IF EXISTS dashboards`);
      await db.execute(`DROP TABLE IF EXISTS users`);
    }

    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT CHECK(role IN ('Employee', 'Manager', 'Admin')) NOT NULL,
        manager_id TEXT
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS dashboards (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        program_line TEXT DEFAULT 'Default Program',
        objective TEXT,
        status TEXT CHECK(status IN ('On Track', 'At Risk', 'Off Track')) DEFAULT 'On Track',
        notes TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS dashboard_items (
        id TEXT PRIMARY KEY,
        dashboard_id TEXT NOT NULL,
        section TEXT CHECK(section IN ('key_skill', 'gap', 'training_plan')) NOT NULL,
        category TEXT,
        title TEXT NOT NULL,
        description TEXT,
        deadline TEXT,
        FOREIGN KEY(dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS submission_requests (
        id TEXT PRIMARY KEY,
        manager_id TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        deadline TEXT NOT NULL,
        status TEXT CHECK(status IN ('Pending', 'Submitted')) DEFAULT 'Pending',
        FOREIGN KEY(manager_id) REFERENCES users(id),
        FOREIGN KEY(employee_id) REFERENCES users(id)
      )
    `);

    await db.execute(`CREATE INDEX IF NOT EXISTS idx_users_manager_id ON users(manager_id);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_dashboards_user_id ON dashboards(user_id);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_dashboard_items_dashboard_id ON dashboard_items(dashboard_id);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_submission_requests_employee_id ON submission_requests(employee_id);`);

    console.log('SQLite database initialized successfully!');
  } catch (err: any) {
    console.error('SQLite initialization failed:', err.message);
  }
}
