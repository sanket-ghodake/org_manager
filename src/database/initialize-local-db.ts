import { db } from './connection';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Initializing local database schema...');

  // Create structural_metadata table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS structural_metadata (
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
    CREATE TABLE IF NOT EXISTS users (
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
    CREATE TABLE IF NOT EXISTS system_logs (
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
    INSERT INTO structural_metadata (type, name, sort_order)
    VALUES ('company_name', 'Acme Corp', 0)
    ON CONFLICT DO NOTHING;
  `);

  // Seed default Super Admin user
  const adminPasswordHash = '$2b$10$YourSecureHashOrBcrypt'; 
  await db.execute(sql`
    INSERT INTO users (eid, name, email, password_hash, is_password_changed, role)
    VALUES ('E0001', 'Super Admin', 'admin@acmecorp.com', ${adminPasswordHash}, false, 'super_admin')
    ON CONFLICT (email) DO NOTHING;
  `);

  console.log('Local database initialization completed successfully!');
}

main().catch((err) => {
  console.error('Failed to initialize local database:', err);
  process.exit(1);
});
