import { createClient } from '@libsql/client';
import { DATABASE_URL } from '../config';

export const db = createClient({
  url: DATABASE_URL,
});

export async function initDb() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT CHECK(role IN ('Employee', 'Manager', 'Admin')) NOT NULL,
        manager_id TEXT,
        FOREIGN KEY(manager_id) REFERENCES users(id)
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

    console.log('SQLite database initialized successfully!');
  } catch (err: any) {
    console.error('SQLite initialization failed:', err.message);
  }
}
