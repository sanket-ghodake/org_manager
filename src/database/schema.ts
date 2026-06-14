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
  
  // App Manifest v2 Fields
  clientId: varchar('client_id', { length: 255 }).unique(),
  clientSecret: varchar('client_secret', { length: 255 }),
  redirectUri: varchar('redirect_uri', { length: 255 }),
  scopes: jsonb('scopes').default([]).notNull(), // List of base/requested permissions (e.g. ['user.profile.read'])

  // Conditional Allocation Matrix Rule
  // Example Value: { "designations": ["uuid-1"], "verticals": ["uuid-2"], "minJobLevel": 2 }
  targetRules: jsonb('target_rules').default({}).notNull(),

  // Sprint B Lifecycle & Health Monitoring
  isEnabled: boolean('is_enabled').default(true).notNull(),
  status: varchar('status', { length: 30 }).default('active').notNull(), // 'active' | 'offline' | 'degraded'
  lastSeen: timestamp('last_seen'),
  healthCheckUrl: varchar('health_check_url', { length: 255 }),
  
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

// Permission Engine (ACL / Hierarchical RBAC)
export const roles = pgTable('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).unique().notNull(), // 'super_admin' | 'admin' | 'read_only_admin' | 'user'
  parentRoleId: uuid('parent_role_id').references((): any => roles.id), // Self reference for hierarchical RBAC delegation
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const permissions = pgTable('permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  action: varchar('action', { length: 100 }).unique().notNull(), // e.g., 'user.profile.read', 'audit.log.write'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const rolePermissions = pgTable('role_permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  roleId: uuid('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  permissionId: uuid('permission_id').references(() => permissions.id, { onDelete: 'cascade' }).notNull(),
});

export const userRoles = pgTable('user_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  roleId: uuid('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
});

// Handshake & Auth Handshake exchange flows
export const forgeAuthCodes = pgTable('forge_auth_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 255 }).unique().notNull(),
  appId: uuid('app_id').references(() => forgeApps.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  used: boolean('used').default(false).notNull(),
  scope: jsonb('scope').default([]).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const forgeAccessTokens = pgTable('forge_access_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  accessToken: varchar('access_token', { length: 255 }).unique().notNull(),
  appId: uuid('app_id').references(() => forgeApps.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  scope: jsonb('scope').default([]).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Identity Foundation Tables (Departments, Teams, Groups)
export const departments = pgTable('departments', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  parentId: uuid('parent_id'), // hierarchical link to self
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const teams = pgTable('teams', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const groups = pgTable('groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userTeams = pgTable('user_teams', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull(),
});

export const userGroups = pgTable('user_groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  groupId: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }).notNull(),
});


