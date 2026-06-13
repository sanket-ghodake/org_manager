import { db } from './connection';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Seeding database with structural baseline configurations...');

  // Deleting existing records cleanly (considering foreign key references)
  await db.execute(sql`TRUNCATE TABLE forge_app_storage CASCADE;`);
  await db.execute(sql`TRUNCATE TABLE forge_apps CASCADE;`);
  await db.execute(sql`TRUNCATE TABLE system_logs CASCADE;`);
  await db.execute(sql`TRUNCATE TABLE users CASCADE;`);
  await db.execute(sql`TRUNCATE TABLE structural_metadata CASCADE;`);

  console.log('Inserting company metadata...');
  // Company metadata
  await db.execute(sql`
    INSERT INTO structural_metadata (id, type, name, sort_order)
    VALUES ('a0000000-0000-0000-0000-000000000001', 'company_name', 'SG Forge', 0);
  `);

  console.log('Inserting 3 Business Verticals...');
  // business verticals
  const verticals = [
    { id: '10000000-0000-0000-0000-000000000001', name: 'Executive', sortOrder: 0 },
    { id: '10000000-0000-0000-0000-000000000002', name: 'Engineering', sortOrder: 1 },
    { id: '10000000-0000-0000-0000-000000000003', name: 'Marketing', sortOrder: 2 },
  ];
  for (const v of verticals) {
    await db.execute(sql`
      INSERT INTO structural_metadata (id, type, name, sort_order)
      VALUES (${v.id}, 'vertical', ${v.name}, ${v.sortOrder});
    `);
  }

  console.log('Inserting 4 Sequential Job Rank Levels...');
  // sequential job rank levels
  const designations = [
    { id: '20000000-0000-0000-0000-000000000001', name: 'CEO', sortOrder: 0 },
    { id: '20000000-0000-0000-0000-000000000002', name: 'VP', sortOrder: 1 },
    { id: '20000000-0000-0000-0000-000000000005', name: 'Manager', sortOrder: 2 },
    { id: '20000000-0000-0000-0000-000000000007', name: 'Staff', sortOrder: 3 },
  ];
  for (const d of designations) {
    await db.execute(sql`
      INSERT INTO structural_metadata (id, type, name, sort_order)
      VALUES (${d.id}, 'job_level', ${d.name}, ${d.sortOrder});
    `);
  }

  console.log('Inserting Super Admin account...');
  const adminPasswordHash = '$2b$10$8Gub3V3ScET0bRZPdM8ONeG543SkOwVKLcfO6jU0CjmGlGxPRrAVm'; // password123
  await db.execute(sql`
    INSERT INTO users (id, eid, name, email, password_hash, is_password_changed, role, designation_id, vertical_id, manager_id)
    VALUES (
      '90000000-0000-0000-0000-000000000001',
      'E0001',
      'Super Admin',
      'admin@sgforge.com',
      ${adminPasswordHash},
      false,
      'super_admin',
      '20000000-0000-0000-0000-000000000001', -- CEO
      '10000000-0000-0000-0000-000000000001', -- Executive
      NULL
    );
  `);

  console.log('Seeding completed successfully.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to seed database:', err);
  process.exit(1);
});
