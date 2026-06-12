import { pgTable, uuid, varchar, boolean, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';

// Core User Account Profiles
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  eid: varchar('eid', { length: 50 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  isPasswordChanged: boolean('is_password_changed').default(false).notNull(),
  role: varchar('role', { length: 30 }).default('user').notNull(), // 'super_admin' | 'admin' | 'read_only_admin' | 'user'
  designationId: uuid('designation_id').references(() => structuralMetadata.id),
  verticalId: uuid('vertical_id').references(() => structuralMetadata.id),
  managerId: uuid('manager_id'), // Relational self-reference to immediate upline user id
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Dynamic Metadata Definition Matrix
export const structuralMetadata = pgTable('structural_metadata', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: varchar('type', { length: 50 }).notNull(), // 'company_name' | 'vertical' | 'job_level'
  name: varchar('name', { length: 255 }).notNull(),
  parentId: uuid('parent_id'), // Used for nested organizational levels or reporting units
  sortOrder: integer('sort_order').default(0).notNull(),
  extendedAttributes: jsonb('extended_attributes').default({}), // Caters to custom operational key-value fields
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// System Log Ring-Buffer Model
export const systemLogs = pgTable('system_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(), // 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'
  payload: jsonb('payload').default({}),
  ipAddress: varchar('ip_address', { length: 45 }),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Forge App Registry Ledger
export const forgeApps = pgTable('forge_apps', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 50 }).unique().notNull(), // e.g., 'nexus-provisioning'
  name: varchar('name', { length: 100 }).notNull(),
  entryUrl: varchar('entry_url', { length: 255 }).notNull(), // Intranet target IP or internal routing path
  isIsolatedLifecycle: boolean('is_isolated_lifecycle').default(true).notNull(),
  
  // Conditional Allocation Matrix Rule
  // Example Value: { "designations": ["uuid-1"], "verticals": ["uuid-2"], "minJobLevel": 2 }
  targetRules: jsonb('target_rules').default({}).notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// App Database Isolation Provisioning Matrix
export const forgeAppStorage = pgTable('forge_app_storage', {
  id: uuid('id').defaultRandom().primaryKey(),
  appId: uuid('app_id').references(() => forgeApps.id).notNull(),
  customSchemaNamespace: varchar('custom_schema_namespace', { length: 63 }).unique().notNull(), // Isolated database namespace
  allowBaseReadAccess: boolean('allow_base_read_access').default(false).notNull(),
});

