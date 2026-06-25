import { createClient } from '@libsql/client';
import { DATABASE_URL } from '../config';
import fs from 'fs';
import path from 'path';
import { seedDummyData } from '../../test/seed-dummy-data';

// Ensure parent directory of the database file exists before instantiating the client
if (DATABASE_URL.startsWith('file:')) {
  const dbPath = DATABASE_URL.substring(5);
  const dbDir = path.dirname(dbPath);
  if (dbDir && dbDir !== '.' && !fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`Created database volume directory: ${dbDir}`);
  }
}

export const db = createClient({
  url: DATABASE_URL,
});

export async function initDb() {
  try {
    // Enable foreign key constraint enforcement and optimize SQLite for high concurrency
    await db.execute(`PRAGMA foreign_keys = ON;`);
    await db.execute(`PRAGMA journal_mode = WAL;`);
    await db.execute(`PRAGMA synchronous = NORMAL;`);
    await db.execute(`PRAGMA busy_timeout = 5000;`);
    // Check if the old schema with manager_id foreign key exists
    const fkCheck = await db.execute(`PRAGMA foreign_key_list(users)`);
    const hasManagerFk = fkCheck.rows?.some(
      (row: any) => row.from === 'manager_id'
    );

    // Check if designation column is missing in users table
    const tableInfo = await db.execute(`PRAGMA table_info(users)`);
    const hasDesignation = tableInfo.rows?.some(
      (row: any) => row.name === 'designation'
    );

    // Check if feedback column is missing in submission_requests table
    let hasFeedback = false;
    const subTableCheck = await db.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name='submission_requests'`);
    if (subTableCheck.rows && subTableCheck.rows.length > 0) {
      const subTableInfo = await db.execute(`PRAGMA table_info(submission_requests)`);
      hasFeedback = subTableInfo.rows?.some(
        (row: any) => row.name === 'feedback'
      );
    }

    // Check if dashboards table enforces unique user_id (old constraint)
    let isDashboardUnique = false;
    let hasStatus = false;
    let hasIsDeleted = false;
    const dashTableCheck = await db.execute(`SELECT sql FROM sqlite_master WHERE type='table' AND name='dashboards'`);
    if (dashTableCheck.rows && dashTableCheck.rows.length > 0) {
      const sql = dashTableCheck.rows[0].sql as string;
      if (sql.includes('user_id TEXT UNIQUE') || sql.includes('user_id TEXT NOT NULL UNIQUE') || sql.includes('UNIQUE')) {
        isDashboardUnique = true;
      }
      const dashTableInfo = await db.execute(`PRAGMA table_info(dashboards)`);
      hasStatus = dashTableInfo.rows?.some((row: any) => row.name === 'status') || false;
      hasIsDeleted = dashTableInfo.rows?.some((row: any) => row.name === 'is_deleted') || false;
    }

    // Check if dashboard_versions table exists
    const versionsTableCheck = await db.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name='dashboard_versions'`);
    const hasVersionsTable = versionsTableCheck.rows && versionsTableCheck.rows.length > 0;

    // Check if new training plan tracking columns are missing in dashboard_items
    let hasNewPlanColumns = false;
    const itemsTableCheck = await db.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name='dashboard_items'`);
    if (itemsTableCheck.rows && itemsTableCheck.rows.length > 0) {
      const itemsTableInfo = await db.execute(`PRAGMA table_info(dashboard_items)`);
      hasNewPlanColumns = itemsTableInfo.rows?.some((row: any) => row.name === 'status') || false;
    }

    if (
      hasStatus || 
      isDashboardUnique || 
      hasManagerFk || 
      !hasIsDeleted ||
      !hasVersionsTable ||
      (tableInfo.rows && tableInfo.rows.length > 0 && !hasDesignation) || 
      (subTableCheck.rows && subTableCheck.rows.length > 0 && !hasFeedback) ||
      (itemsTableCheck.rows && itemsTableCheck.rows.length > 0 && !hasNewPlanColumns)
    ) {
      console.log('Recreating tables to remove dashboard status, support multiple dashboards, or update schemas...');
      await db.execute(`DROP TABLE IF EXISTS submission_requests`);
      await db.execute(`DROP TABLE IF EXISTS dashboard_item_links`);
      await db.execute(`DROP TABLE IF EXISTS dashboard_items`);
      await db.execute(`DROP TABLE IF EXISTS dashboard_versions`);
      await db.execute(`DROP TABLE IF EXISTS dashboards`);
      await db.execute(`DROP TABLE IF EXISTS users`);
    }

    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT CHECK(role IN ('Employee', 'Manager', 'Admin')) NOT NULL,
        manager_id TEXT,
        designation TEXT
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS dashboards (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        program_line TEXT DEFAULT 'Default Program',
        objective TEXT,
        notes TEXT,
        is_deleted INTEGER DEFAULT 0,
        deleted_at TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS dashboard_versions (
        id TEXT PRIMARY KEY,
        dashboard_id TEXT NOT NULL,
        version_name TEXT NOT NULL,
        snapshot TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
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
        status TEXT DEFAULT 'not_started',
        target_quarter TEXT,
        completed_quarter TEXT,
        FOREIGN KEY(dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS dashboard_item_links (
        id TEXT PRIMARY KEY,
        dashboard_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        FOREIGN KEY(dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE,
        FOREIGN KEY(source_id) REFERENCES dashboard_items(id) ON DELETE CASCADE,
        FOREIGN KEY(target_id) REFERENCES dashboard_items(id) ON DELETE CASCADE,
        UNIQUE(source_id, target_id)
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS submission_requests (
        id TEXT PRIMARY KEY,
        manager_id TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        deadline TEXT NOT NULL,
        status TEXT CHECK(status IN ('Pending', 'Submitted', 'Approved', 'Needs Revision')) DEFAULT 'Pending',
        feedback TEXT,
        submitted_at TEXT,
        reviewed_at TEXT,
        FOREIGN KEY(manager_id) REFERENCES users(id),
        FOREIGN KEY(employee_id) REFERENCES users(id)
      )
    `);

    await db.execute(`CREATE INDEX IF NOT EXISTS idx_users_manager_id ON users(manager_id);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_dashboards_user_id ON dashboards(user_id);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_dashboard_items_dashboard_id ON dashboard_items(dashboard_id);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_dashboard_item_links_dashboard_id ON dashboard_item_links(dashboard_id);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_dashboard_item_links_source_id ON dashboard_item_links(source_id);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_dashboard_item_links_target_id ON dashboard_item_links(target_id);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_submission_requests_employee_id ON submission_requests(employee_id);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_dashboard_versions_dashboard_id ON dashboard_versions(dashboard_id);`);

    await seedDummyData(db);
    console.log('SQLite database initialized successfully!');
  } catch (err: any) {
    console.error('SQLite initialization failed:', err.message);
  }
}
