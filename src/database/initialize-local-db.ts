import { db } from './connection';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Initializing local database schema...');

  // Drop existing tables to ensure clean state
  await db.execute(sql`DROP TABLE IF EXISTS system_logs CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS users CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS structural_metadata CASCADE;`);

  // Create structural_metadata table
  await db.execute(sql`
    CREATE TABLE structural_metadata (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      parent_id UUID,
      sort_order INTEGER DEFAULT 0 NOT NULL,
      extended_attributes JSONB DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  // Create users table
  await db.execute(sql`
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      eid VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      is_password_changed BOOLEAN DEFAULT false NOT NULL,
      role VARCHAR(30) DEFAULT 'user' NOT NULL,
      designation_id UUID REFERENCES structural_metadata(id),
      vertical_id UUID REFERENCES structural_metadata(id),
      manager_id UUID,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  // Create system_logs table
  await db.execute(sql`
    CREATE TABLE system_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      action VARCHAR(100) NOT NULL,
      severity VARCHAR(20) NOT NULL,
      payload JSONB DEFAULT '{}'::jsonb,
      ip_address VARCHAR(45),
      timestamp TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  // Create pruning function and trigger for 100,000 rolling log buffer
  console.log('Configuring rolling system log buffer (100,000 cap trigger)...');
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION prune_system_logs_buffer()
    RETURNS TRIGGER AS $$
    BEGIN
      IF (SELECT COUNT(*) FROM system_logs) > 100000 THEN
        DELETE FROM system_logs
        WHERE id IN (
          SELECT id FROM system_logs 
          ORDER BY timestamp ASC 
          LIMIT (SELECT COUNT(*) FROM system_logs) - 100000
        );
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await db.execute(sql`
    DROP TRIGGER IF EXISTS trigger_prune_system_logs ON system_logs;
    CREATE TRIGGER trigger_prune_system_logs
    AFTER INSERT ON system_logs
    FOR EACH STATEMENT
    EXECUTE FUNCTION prune_system_logs_buffer();
  `);

  console.log('Seeding initial system structures...');

  // Seed default metadata
  await db.execute(sql`
    INSERT INTO structural_metadata (id, type, name, sort_order)
    VALUES ('a0000000-0000-0000-0000-000000000001', 'company_name', 'Acme Corp', 0);
  `);

  // Seed Verticals
  const verticals = [
    { id: '10000000-0000-0000-0000-000000000001', name: 'Executive' },
    { id: '10000000-0000-0000-0000-000000000002', name: 'Engineering' },
    { id: '10000000-0000-0000-0000-000000000003', name: 'Marketing' },
    { id: '10000000-0000-0000-0000-000000000004', name: 'Finance' },
  ];
  for (const v of verticals) {
    await db.execute(sql`
      INSERT INTO structural_metadata (id, type, name, sort_order)
      VALUES (${v.id}, 'vertical', ${v.name}, 0);
    `);
  }

  // Seed Designations
  const designations = [
    { id: '20000000-0000-0000-0000-000000000001', name: 'CEO' },
    { id: '20000000-0000-0000-0000-000000000002', name: 'VP of Engineering' },
    { id: '20000000-0000-0000-0000-000000000003', name: 'VP of Marketing' },
    { id: '20000000-0000-0000-0000-000000000004', name: 'CFO' },
    { id: '20000000-0000-0000-0000-000000000005', name: 'Engineering Manager' },
    { id: '20000000-0000-0000-0000-000000000006', name: 'Senior Engineer' },
    { id: '20000000-0000-0000-0000-000000000007', name: 'Software Engineer' },
    { id: '20000000-0000-0000-0000-000000000008', name: 'Marketing Specialist' },
    { id: '20000000-0000-0000-0000-000000000009', name: 'Financial Analyst' },
  ];
  for (const d of designations) {
    await db.execute(sql`
      INSERT INTO structural_metadata (id, type, name, sort_order)
      VALUES (${d.id}, 'job_level', ${d.name}, 0);
    `);
  }

  // Seed Users with accurate designation_id, vertical_id, and manager_id
  const adminPasswordHash = '$2b$10$8Gub3V3ScET0bRZPdM8ONeG543SkOwVKLcfO6jU0CjmGlGxPRrAVm'; // password123

  // E0001: CEO
  const ceoId = '90000000-0000-0000-0000-000000000001';
  await db.execute(sql`
    INSERT INTO users (id, eid, name, email, password_hash, is_password_changed, role, designation_id, vertical_id, manager_id)
    VALUES (${ceoId}, 'E0001', 'Super Admin', 'admin@acmecorp.com', ${adminPasswordHash}, false, 'super_admin', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL);
  `);

  // E0002: VP of Eng
  const vpEngId = '90000000-0000-0000-0000-000000000002';
  await db.execute(sql`
    INSERT INTO users (id, eid, name, email, password_hash, is_password_changed, role, designation_id, vertical_id, manager_id)
    VALUES (${vpEngId}, 'E0002', 'Admin One', 'admin1@acmecorp.com', ${adminPasswordHash}, false, 'admin', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', ${ceoId});
  `);

  // E0003: VP of Mkt
  const vpMktId = '90000000-0000-0000-0000-000000000003';
  await db.execute(sql`
    INSERT INTO users (id, eid, name, email, password_hash, is_password_changed, role, designation_id, vertical_id, manager_id)
    VALUES (${vpMktId}, 'E0003', 'Admin Two', 'admin2@acmecorp.com', ${adminPasswordHash}, false, 'admin', '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', ${ceoId});
  `);

  // E0004: CFO
  const cfoId = '90000000-0000-0000-0000-000000000004';
  await db.execute(sql`
    INSERT INTO users (id, eid, name, email, password_hash, is_password_changed, role, designation_id, vertical_id, manager_id)
    VALUES (${cfoId}, 'E0004', 'ReadOnly Admin', 'readonly@acmecorp.com', ${adminPasswordHash}, false, 'read_only_admin', '20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', ${ceoId});
  `);

  // E0005: Engineering Manager
  const engMgrId = '90000000-0000-0000-0000-000000000005';
  await db.execute(sql`
    INSERT INTO users (id, eid, name, email, password_hash, is_password_changed, role, designation_id, vertical_id, manager_id)
    VALUES (${engMgrId}, 'E0005', 'Alice Smith', 'alice@acmecorp.com', ${adminPasswordHash}, false, 'user', '20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', ${vpEngId});
  `);

  // E0006: Senior Engineer (reports to Eng Manager)
  const srEngId = '90000000-0000-0000-0000-000000000006';
  await db.execute(sql`
    INSERT INTO users (id, eid, name, email, password_hash, is_password_changed, role, designation_id, vertical_id, manager_id)
    VALUES (${srEngId}, 'E0006', 'Bob Jones', 'bob@acmecorp.com', ${adminPasswordHash}, false, 'user', '20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', ${engMgrId});
  `);

  // E0007: Software Engineer (reports to Eng Manager)
  const swEngId = '90000000-0000-0000-0000-000000000007';
  await db.execute(sql`
    INSERT INTO users (id, eid, name, email, password_hash, is_password_changed, role, designation_id, vertical_id, manager_id)
    VALUES (${swEngId}, 'E0007', 'Charlie Brown', 'charlie@acmecorp.com', ${adminPasswordHash}, false, 'user', '20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000002', ${engMgrId});
  `);

  // E0008: Software Engineer (reports to VP of Eng directly for testing flat structures)
  const swEngId2 = '90000000-0000-0000-0000-000000000008';
  await db.execute(sql`
    INSERT INTO users (id, eid, name, email, password_hash, is_password_changed, role, designation_id, vertical_id, manager_id)
    VALUES (${swEngId2}, 'E0008', 'Diana Prince', 'diana@acmecorp.com', ${adminPasswordHash}, false, 'user', '20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000002', ${vpEngId});
  `);

  // E0009: Marketing Specialist (reports to VP of Marketing)
  const mktSpecId = '90000000-0000-0000-0000-000000000009';
  await db.execute(sql`
    INSERT INTO users (id, eid, name, email, password_hash, is_password_changed, role, designation_id, vertical_id, manager_id)
    VALUES (${mktSpecId}, 'E0009', 'Evan Wright', 'evan@acmecorp.com', ${adminPasswordHash}, false, 'user', '20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000003', ${vpMktId});
  `);

  // E0010: Financial Analyst (reports to CFO)
  const finId = '90000000-0000-0000-0000-000000000010';
  await db.execute(sql`
    INSERT INTO users (id, eid, name, email, password_hash, is_password_changed, role, designation_id, vertical_id, manager_id)
    VALUES (${finId}, 'E0010', 'Fiona Gallagher', 'fiona@acmecorp.com', ${adminPasswordHash}, false, 'user', '20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000004', ${cfoId});
  `);

  console.log('Local database initialization completed successfully!');
}

main().catch((err) => {
  console.error('Failed to initialize local database:', err);
  process.exit(1);
});
