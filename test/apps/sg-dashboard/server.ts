import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyJwt from '@fastify/jwt';
import { createClient } from '@libsql/client';
import path from 'path';

const PORT = process.env.PORT || 8095;
const PORTAL_INTERNAL_URL = process.env.PORTAL_INTERNAL_URL || 'http://app:3001';
const CLIENT_ID = process.env.CLIENT_ID || 'client_sg_dashboard';
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'secret_sg_dashboard';
const PORTAL_SSO_URL = process.env.PORTAL_SSO_URL || 'http://localhost:3001/api/v1/auth/authorize';
const DATABASE_URL = process.env.DATABASE_URL || 'file:local.db';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_dashboard_jwt_key';

// Initialize libSQL client (SQLite)
const db = createClient({
  url: DATABASE_URL,
});

const fastify = Fastify({ logger: true });

// Register JWT plugin
fastify.register(fastifyJwt, {
  secret: JWT_SECRET,
});

// Register Static plugin for serving index.html
fastify.register(fastifyStatic, {
  root: __dirname,
  prefix: '/',
});

// Setup database tables
async function initDb() {
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
initDb();

// Authentication Guard Middleware
fastify.decorate('authenticate', async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized: Invalid or expired token' });
  }
});

// Helper: Check if User A is an upline manager of User B recursively
async function checkUplineManager(managerId: string, employeeId: string): Promise<boolean> {
  if (!managerId || !employeeId) return false;
  try {
    const res = await db.execute({
      sql: `
        WITH RECURSIVE manager_chain AS (
          SELECT id, manager_id FROM users WHERE id = ?
          UNION ALL
          SELECT u.id, u.manager_id
          FROM users u
          JOIN manager_chain mc ON mc.manager_id = u.id
        )
        SELECT 1 FROM manager_chain WHERE manager_id = ? LIMIT 1
      `,
      args: [employeeId, managerId],
    });
    return res.rows.length > 0;
  } catch (err) {
    console.error('Hierarchy check failed:', err);
    return false;
  }
}

// 1. Config Endpoint
fastify.get('/api/config', async (request, reply) => {
  return {
    clientId: CLIENT_ID,
    portalSsoUrl: PORTAL_SSO_URL,
  };
});

// 2. Auth Handshake Token Exchange
fastify.post('/api/auth', async (request: any, reply) => {
  const { code } = request.body || {};
  if (!code) {
    return reply.status(400).send({ error: 'Authorization code is required' });
  }

  try {
    const urlsToTry = [
      `${PORTAL_INTERNAL_URL}/api/v1/auth/exchange`,
      `http://host.docker.internal:3001/api/v1/auth/exchange`,
      `http://172.21.0.1:3001/api/v1/auth/exchange`,
      `http://172.17.0.1:3001/api/v1/auth/exchange`,
      `http://localhost:3001/api/v1/auth/exchange`,
    ];

    let exchangeRes: Response | null = null;
    let lastError: any = null;

    for (const url of urlsToTry) {
      try {
        console.log(`Exchanging code with Portal backend at ${url}...`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: code.toString(),
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          exchangeRes = res;
          break;
        } else {
          const errText = await res.text();
          lastError = new Error(`Status ${res.status}: ${errText}`);
          if (res.status === 400 || res.status === 401) {
            exchangeRes = res;
            break;
          }
        }
      } catch (err: any) {
        lastError = err;
        console.log(`Failed to connect/auth at ${url}: ${err.message}`);
      }
    }

    if (!exchangeRes) {
      throw lastError || new Error('All auth exchange attempts failed.');
    }

    if (!exchangeRes.ok) {
      throw lastError || new Error(`Token exchange failed (${exchangeRes.status})`);
    }

    const tokenData = (await exchangeRes.json()) as any;
    const { user } = tokenData;

    // Map portal roles to dashboard roles:
    // Portal roles: 'super_admin' | 'admin' | 'read_only_admin' | 'user'
    // Let's dynamically map: 'super_admin' & 'admin' -> 'Admin',
    // We will check if the user is a manager when syncing the directory.
    let mappedRole: 'Employee' | 'Manager' | 'Admin' = 'Employee';
    if (user.role === 'super_admin' || user.role === 'admin') {
      mappedRole = 'Admin';
    }

    // Insert or update logged in user
    await db.execute({
      sql: `
        INSERT INTO users (id, name, email, role)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          email = excluded.email
      `,
      args: [user.id, user.name, user.email, mappedRole],
    });

    // Generate local JWT token
    const token = fastify.jwt.sign({
      id: user.id,
      eid: user.eid,
      name: user.name,
      email: user.email,
      role: mappedRole,
    });

    return { success: true, token, user: { ...user, role: mappedRole } };
  } catch (err: any) {
    console.error('Portal authorization handshake failed:', err.message);
    return reply.status(401).send({ error: `Authorization failed: ${err.message}` });
  }
});

// 3. Sync User Directory & Hierarchy
fastify.post('/api/sync', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
  const { users } = request.body || {};
  if (!Array.isArray(users)) {
    return reply.status(400).send({ error: 'Invalid user directory payload' });
  }

  try {
    // 1. Collect all manager IDs in the payload to determine who is a manager
    const managerIdsSet = new Set<string>();
    for (const u of users) {
      if (u.manager_id || u.managerId) {
        managerIdsSet.add(u.manager_id || u.managerId);
      }
    }

    // 2. Perform batched inserts/updates inside a transaction
    for (const u of users) {
      const email = u.email;
      const id = u.id;
      const name = u.name;
      const managerId = u.manager_id || u.managerId || null;

      // Determine role: Admins stay Admin, managers become Manager, others Employee
      let role: 'Employee' | 'Manager' | 'Admin' = 'Employee';
      if (u.role === 'super_admin' || u.role === 'admin') {
        role = 'Admin';
      } else if (managerIdsSet.has(id)) {
        role = 'Manager';
      }

      await db.execute({
        sql: `
          INSERT INTO users (id, name, email, role, manager_id)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            email = excluded.email,
            role = excluded.role,
            manager_id = excluded.manager_id
        `,
        args: [id, name, email, role, managerId],
      });
    }

    return { success: true, synced: users.length };
  } catch (err: any) {
    console.error('Sync failed:', err.message);
    return reply.status(500).send({ error: `Sync failed: ${err.message}` });
  }
});

// 4. Get Current User's Dashboard
fastify.get('/api/dashboard', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
  const user = request.user;
  try {
    // Check if dashboard exists
    let res = await db.execute({
      sql: 'SELECT * FROM dashboards WHERE user_id = ?',
      args: [user.id],
    });

    if (res.rows.length === 0) {
      // Create a default dashboard for the user
      const dashboardId = crypto.randomUUID();
      await db.execute({
        sql: 'INSERT INTO dashboards (id, user_id, program_line, objective, status, notes) VALUES (?, ?, ?, ?, ?, ?)',
        args: [
          dashboardId,
          user.id,
          'Engineering Strategy',
          'Optimize local resource utilization to achieve enterprise readiness within constraints.',
          'On Track',
          'Automatically created upon initial login.',
        ],
      });

      // Refetch
      res = await db.execute({
        sql: 'SELECT * FROM dashboards WHERE user_id = ?',
        args: [user.id],
      });
    }

    const dashboard = res.rows[0];
    const itemsRes = await db.execute({
      sql: 'SELECT * FROM dashboard_items WHERE dashboard_id = ?',
      args: [dashboard.id],
    });

    return { dashboard, items: itemsRes.rows };
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// 5. Get Specified Dashboard (Hierarchy protected)
fastify.get('/api/dashboard/:userId', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
  const currentUser = request.user;
  const targetUserId = request.params.userId;

  // Rule: Must be owner or an upline manager
  const isOwner = currentUser.id === targetUserId;
  const isManager = await checkUplineManager(currentUser.id, targetUserId);

  if (!isOwner && !isManager && currentUser.role !== 'Admin') {
    return reply.status(403).send({ error: 'Forbidden: Access to this dashboard is restricted' });
  }

  try {
    const res = await db.execute({
      sql: 'SELECT * FROM dashboards WHERE user_id = ?',
      args: [targetUserId],
    });

    if (res.rows.length === 0) {
      return reply.status(404).send({ error: 'Dashboard not initialized yet by employee.' });
    }

    const dashboard = res.rows[0];
    const itemsRes = await db.execute({
      sql: 'SELECT * FROM dashboard_items WHERE dashboard_id = ?',
      args: [dashboard.id],
    });

    return { dashboard, items: itemsRes.rows };
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// 6. Update Dashboard Metadata (Owner only)
fastify.put('/api/dashboard/:id', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
  const user = request.user;
  const dashboardId = request.params.id;
  const { program_line, objective, status, notes } = request.body || {};

  try {
    // Verify ownership
    const ownerRes = await db.execute({
      sql: 'SELECT user_id FROM dashboards WHERE id = ?',
      args: [dashboardId],
    });

    if (ownerRes.rows.length === 0) {
      return reply.status(404).send({ error: 'Dashboard not found' });
    }

    if (ownerRes.rows[0].user_id !== user.id) {
      return reply.status(403).send({ error: 'Forbidden: Only the owner can edit this dashboard' });
    }

    await db.execute({
      sql: `
        UPDATE dashboards
        SET program_line = ?, objective = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [program_line || 'Default Program', objective || '', status || 'On Track', notes || '', dashboardId],
    });

    return { success: true };
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// 7. Add Dashboard Item (Owner only)
fastify.post('/api/dashboard/:id/items', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
  const user = request.user;
  const dashboardId = request.params.id;
  const { section, category, title, description, deadline } = request.body || {};

  if (!section || !title) {
    return reply.status(400).send({ error: 'Section and Title are required.' });
  }

  try {
    // Verify ownership
    const ownerRes = await db.execute({
      sql: 'SELECT user_id FROM dashboards WHERE id = ?',
      args: [dashboardId],
    });

    if (ownerRes.rows.length === 0) {
      return reply.status(404).send({ error: 'Dashboard not found' });
    }

    if (ownerRes.rows[0].user_id !== user.id) {
      return reply.status(403).send({ error: 'Forbidden: Only the owner can add items to this dashboard' });
    }

    const itemId = crypto.randomUUID();
    await db.execute({
      sql: 'INSERT INTO dashboard_items (id, dashboard_id, section, category, title, description, deadline) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [itemId, dashboardId, section, category || '', title, description || '', deadline || ''],
    });

    return { success: true, itemId };
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// 8. Delete Dashboard Item (Owner only)
fastify.delete('/api/dashboard/items/:itemId', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
  const user = request.user;
  const itemId = request.params.itemId;

  try {
    // Find the dashboard item and verify dashboard ownership
    const res = await db.execute({
      sql: `
        SELECT d.user_id
        FROM dashboard_items i
        JOIN dashboards d ON i.dashboard_id = d.id
        WHERE i.id = ?
      `,
      args: [itemId],
    });

    if (res.rows.length === 0) {
      return reply.status(404).send({ error: 'Item not found' });
    }

    if (res.rows[0].user_id !== user.id) {
      return reply.status(403).send({ error: 'Forbidden: Only the owner can delete this item' });
    }

    await db.execute({
      sql: 'DELETE FROM dashboard_items WHERE id = ?',
      args: [itemId],
    });

    return { success: true };
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// 9. Get Team Members & Dashboards (Manager/Admin only)
fastify.get('/api/team', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
  const user = request.user;

  try {
    let reportsRes;
    if (user.role === 'Admin') {
      // Admin sees everyone
      reportsRes = await db.execute({
        sql: 'SELECT id, name, email, role, manager_id FROM users WHERE id != ? ORDER BY name ASC',
        args: [user.id],
      });
    } else {
      // Managers see direct and indirect reports (recursive manager chain)
      reportsRes = await db.execute({
        sql: `
          WITH RECURSIVE reports AS (
            SELECT id, name, email, role, manager_id
            FROM users
            WHERE manager_id = ?
            UNION ALL
            SELECT u.id, u.name, u.email, u.role, u.manager_id
            FROM users u
            JOIN reports r ON u.manager_id = r.id
          )
          SELECT DISTINCT id, name, email, role, manager_id FROM reports ORDER BY name ASC
        `,
        args: [user.id],
      });
    }

    const reports = reportsRes.rows;
    const teamData = [];

    for (const report of reports) {
      // Find dashboard
      const dashRes = await db.execute({
        sql: 'SELECT id, status, updated_at FROM dashboards WHERE user_id = ?',
        args: [report.id],
      });

      // Find pending submission requests
      const subRes = await db.execute({
        sql: 'SELECT id, deadline, status FROM submission_requests WHERE employee_id = ? ORDER BY deadline DESC LIMIT 1',
        args: [report.id],
      });

      teamData.push({
        id: report.id,
        name: report.name,
        email: report.email,
        role: report.role,
        managerId: report.manager_id,
        hasDashboard: dashRes.rows.length > 0,
        dashboardId: dashRes.rows[0]?.id || null,
        dashboardStatus: dashRes.rows[0]?.status || 'Not Started',
        dashboardUpdatedAt: dashRes.rows[0]?.updated_at || null,
        lastSubmissionStatus: subRes.rows[0]?.status || null,
        lastSubmissionDeadline: subRes.rows[0]?.deadline || null,
      });
    }

    return { team: teamData };
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// 10. Get Submissions Requests (Employee)
fastify.get('/api/submissions', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
  const user = request.user;
  try {
    const res = await db.execute({
      sql: `
        SELECT s.*, u.name as manager_name
        FROM submission_requests s
        JOIN users u ON s.manager_id = u.id
        WHERE s.employee_id = ?
        ORDER BY s.deadline DESC
      `,
      args: [user.id],
    });
    return { submissions: res.rows };
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// 11. Create Submission Request (Manager -> Report only)
fastify.post('/api/submissions', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
  const user = request.user;
  const { employee_id, deadline } = request.body || {};

  if (!employee_id || !deadline) {
    return reply.status(400).send({ error: 'employee_id and deadline are required.' });
  }

  try {
    // Verify target employee reports to this manager (immediate check or recursive)
    const empRes = await db.execute({
      sql: 'SELECT manager_id FROM users WHERE id = ?',
      args: [employee_id],
    });

    if (empRes.rows.length === 0) {
      return reply.status(404).send({ error: 'Employee not found.' });
    }

    const immediateManagerId = empRes.rows[0].manager_id;
    if (immediateManagerId !== user.id && user.role !== 'Admin') {
      return reply.status(403).send({ error: 'Forbidden: You can only request submissions from your direct reports.' });
    }

    const submissionId = crypto.randomUUID();
    await db.execute({
      sql: 'INSERT INTO submission_requests (id, manager_id, employee_id, deadline, status) VALUES (?, ?, ?, ?, ?)',
      args: [submissionId, user.id, employee_id, deadline, 'Pending'],
    });

    return { success: true, submissionId };
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// 12. Submit Dashboard (Employee)
fastify.post('/api/submissions/:id/submit', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
  const user = request.user;
  const requestId = request.params.id;

  try {
    // Verify ownership of the request
    const reqRes = await db.execute({
      sql: 'SELECT employee_id FROM submission_requests WHERE id = ?',
      args: [requestId],
    });

    if (reqRes.rows.length === 0) {
      return reply.status(404).send({ error: 'Submission request not found.' });
    }

    if (reqRes.rows[0].employee_id !== user.id) {
      return reply.status(403).send({ error: 'Forbidden: Only the assigned employee can submit.' });
    }

    // Update status to Submitted
    await db.execute({
      sql: 'UPDATE submission_requests SET status = "Submitted" WHERE id = ?',
      args: [requestId],
    });

    return { success: true };
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// Serve spa entrypoint for all non-api routes
fastify.get('*', async (request, reply) => {
  return reply.sendFile('index.html');
});

// Start the server
const start = async () => {
  try {
    await fastify.listen({ port: Number(PORT), host: '0.0.0.0' });
    console.log(`Server is running on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
