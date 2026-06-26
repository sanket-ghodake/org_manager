import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { seedDummyData } from "../../test/seed-dummy-data";
import { DATABASE_URL } from "../config";

// Ensure parent directory of the database file exists before instantiating the client
if (DATABASE_URL.startsWith("file:")) {
  const dbPath = DATABASE_URL.substring(5);
  const dbDir = path.dirname(dbPath);
  if (dbDir && dbDir !== "." && !fs.existsSync(dbDir)) {
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
    // 1. users: check designation column
    const tableInfo = await db.execute(`PRAGMA table_info(users)`);
    const hasUsersTable = tableInfo.rows && tableInfo.rows.length > 0;
    if (hasUsersTable) {
      const hasDesignation = tableInfo.rows.some(
        (row: any) => row.name === "designation",
      );
      if (!hasDesignation) {
        await db.execute(`ALTER TABLE users ADD COLUMN designation TEXT;`);
        console.log("Migrated: Added designation column to users table.");
      }
    }

    // 2. dashboards: check if table exists and constraints
    const dashTableCheck = await db.execute(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='dashboards'`,
    );
    const hasDashboardsTable =
      dashTableCheck.rows && dashTableCheck.rows.length > 0;
    if (hasDashboardsTable) {
      const sql = dashTableCheck.rows[0].sql as string;
      const isDashboardUnique =
        sql.includes("user_id TEXT UNIQUE") ||
        sql.includes("user_id TEXT NOT NULL UNIQUE") ||
        sql.includes("UNIQUE");

      const dashTableInfo = await db.execute(`PRAGMA table_info(dashboards)`);
      const hasIsDeleted = dashTableInfo.rows?.some(
        (row: any) => row.name === "is_deleted",
      );

      if (isDashboardUnique || !hasIsDeleted) {
        console.log("Migrating dashboards table non-destructively...");
        await db.execute("BEGIN TRANSACTION");
        try {
          await db.execute(`ALTER TABLE dashboards RENAME TO temp_dashboards;`);
          await db.execute(`
            CREATE TABLE dashboards (
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
            INSERT INTO dashboards (id, user_id, program_line, objective, notes, is_deleted, deleted_at, updated_at)
            SELECT id, user_id, program_line, objective, notes, 
                   COALESCE(is_deleted, 0), deleted_at, COALESCE(updated_at, CURRENT_TIMESTAMP)
            FROM temp_dashboards;
          `);
          await db.execute(`DROP TABLE temp_dashboards;`);
          await db.execute("COMMIT");
          console.log("Migrated: dashboards table successfully updated.");
        } catch (err: any) {
          await db.execute("ROLLBACK");
          console.error(
            "Migration of dashboards table failed, rolling back:",
            err.message,
          );
          throw err;
        }
      }
    }

    // 3. dashboard_items: check status column
    const itemsTableCheck = await db.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='dashboard_items'`,
    );
    if (itemsTableCheck.rows && itemsTableCheck.rows.length > 0) {
      const itemsTableInfo = await db.execute(
        `PRAGMA table_info(dashboard_items)`,
      );
      const hasStatus = itemsTableInfo.rows?.some(
        (row: any) => row.name === "status",
      );
      if (!hasStatus) {
        await db.execute(
          `ALTER TABLE dashboard_items ADD COLUMN status TEXT DEFAULT 'not_started';`,
        );
        console.log("Migrated: Added status column to dashboard_items table.");
      }
    }

    // 4. submission_requests: check feedback and dashboard_id
    const subTableCheck = await db.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='submission_requests'`,
    );
    if (subTableCheck.rows && subTableCheck.rows.length > 0) {
      const subTableInfo = await db.execute(
        `PRAGMA table_info(submission_requests)`,
      );
      const hasFeedback = subTableInfo.rows?.some(
        (row: any) => row.name === "feedback",
      );
      const hasDashboardId = subTableInfo.rows?.some(
        (row: any) => row.name === "dashboard_id",
      );

      if (!hasFeedback) {
        await db.execute(
          `ALTER TABLE submission_requests ADD COLUMN feedback TEXT;`,
        );
        console.log(
          "Migrated: Added feedback column to submission_requests table.",
        );
      }
      if (!hasDashboardId) {
        await db.execute(
          `ALTER TABLE submission_requests ADD COLUMN dashboard_id TEXT;`,
        );
        console.log(
          "Migrated: Added dashboard_id column to submission_requests table.",
        );
      }
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
        dashboard_id TEXT,
        deadline TEXT NOT NULL,
        status TEXT CHECK(status IN ('Pending', 'Submitted', 'Approved', 'Needs Revision')) DEFAULT 'Pending',
        feedback TEXT,
        submitted_at TEXT,
        reviewed_at TEXT,
        FOREIGN KEY(manager_id) REFERENCES users(id),
        FOREIGN KEY(employee_id) REFERENCES users(id),
        FOREIGN KEY(dashboard_id) REFERENCES dashboards(id) ON DELETE SET NULL
      )
    `);

    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_users_manager_id ON users(manager_id);`,
    );
    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);`,
    );
    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
    );
    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_dashboards_user_id ON dashboards(user_id);`,
    );
    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_dashboard_items_dashboard_id ON dashboard_items(dashboard_id);`,
    );
    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_dashboard_item_links_dashboard_id ON dashboard_item_links(dashboard_id);`,
    );
    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_dashboard_item_links_source_id ON dashboard_item_links(source_id);`,
    );
    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_dashboard_item_links_target_id ON dashboard_item_links(target_id);`,
    );
    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_submission_requests_employee_id ON submission_requests(employee_id);`,
    );
    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_dashboard_versions_dashboard_id ON dashboard_versions(dashboard_id);`,
    );

    // Add SQLite triggers for updating dashboards.updated_at automatically
    await db.execute(`
      CREATE TRIGGER IF NOT EXISTS trg_dashboard_items_update
      AFTER UPDATE ON dashboard_items
      BEGIN
        UPDATE dashboards SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.dashboard_id;
      END;
    `);
    await db.execute(`
      CREATE TRIGGER IF NOT EXISTS trg_dashboard_items_insert
      AFTER INSERT ON dashboard_items
      BEGIN
        UPDATE dashboards SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.dashboard_id;
      END;
    `);
    await db.execute(`
      CREATE TRIGGER IF NOT EXISTS trg_dashboard_items_delete
      AFTER DELETE ON dashboard_items
      BEGIN
        UPDATE dashboards SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.dashboard_id;
      END;
    `);
    await db.execute(`
      CREATE TRIGGER IF NOT EXISTS trg_dashboard_item_links_insert
      AFTER INSERT ON dashboard_item_links
      BEGIN
        UPDATE dashboards SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.dashboard_id;
      END;
    `);
    await db.execute(`
      CREATE TRIGGER IF NOT EXISTS trg_dashboard_item_links_delete
      AFTER DELETE ON dashboard_item_links
      BEGIN
        UPDATE dashboards SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.dashboard_id;
      END;
    `);

    const userCount = await db.execute("SELECT COUNT(*) as count FROM users");
    if (userCount.rows && (userCount.rows[0] as any).count === 0) {
      await seedDummyData(db);
    } else {
      console.log("Database already has users. Skipping seeder.");
    }
    console.log("SQLite database initialized successfully!");
  } catch (err: any) {
    console.error("SQLite initialization failed:", err.message);
  }
}
