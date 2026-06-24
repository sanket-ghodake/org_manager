import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { CLIENT_ID, CLIENT_SECRET, PORTAL_INTERNAL_URL } from '../config';
import { getWorkingPortalUrl } from '../utils/portal';

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/api/auth', async (request: any, reply) => {
    const { code } = request.body || {};
    if (!code) {
      return reply.status(400).send({ error: 'Authorization code is required' });
    }

    try {
      const workingUrl = await getWorkingPortalUrl();
      const exchangeUrl = `${workingUrl}/api/v1/auth/exchange`;
      console.log(`Exchanging code with Portal backend at ${exchangeUrl}...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const exchangeRes = await fetch(exchangeUrl, {
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

      if (!exchangeRes.ok) {
        const errText = await exchangeRes.text();
        throw new Error(`Token exchange failed (${exchangeRes.status}): ${errText}`);
      }

      const tokenData = (await exchangeRes.json()) as any;
      const { user } = tokenData;

      let mappedRole: 'Employee' | 'Manager' | 'Admin' = 'Employee';
      if (user.role === 'super_admin' || user.role === 'admin') {
        mappedRole = 'Admin';
      }

      // Check if user already exists in local DB to preserve role (e.g. 'Manager')
      const localUserRes = await db.execute({
        sql: `SELECT role FROM users WHERE id = ?`,
        args: [user.id]
      });
      const localUser = localUserRes.rows?.[0] as any;
      if (localUser && localUser.role) {
        if (localUser.role === 'Manager' || localUser.role === 'Admin') {
          mappedRole = localUser.role;
        }
      }

      // If still mapped to Employee, check if they have reporting lines on the portal to classify as Manager
      if (mappedRole === 'Employee') {
        try {
          const checkRes = await fetch(`${PORTAL_INTERNAL_URL}/api/directory?managerId=${user.id}`, {
            headers: {
              'x-forge-client-id': CLIENT_ID,
              'x-forge-client-secret': CLIENT_SECRET,
            }
          });
          if (checkRes.ok) {
            const checkData = (await checkRes.json()) as any;
            if (checkData.users && checkData.users.length > 0) {
              mappedRole = 'Manager';
            }
          }
        } catch (err: any) {
          console.warn('Failed to dynamically check manager status on login:', err.message);
        }
      }

      const userManagerId = user.manager_id || user.managerId || null;

      // Insert or update logged in user
      await db.execute({
        sql: `
          INSERT INTO users (id, name, email, role, manager_id, designation)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            email = excluded.email,
            manager_id = COALESCE(excluded.manager_id, users.manager_id),
            designation = COALESCE(excluded.designation, users.designation),
            role = CASE 
              WHEN users.role IN ('Manager', 'Admin') THEN users.role 
              ELSE excluded.role 
            END
        `,
        args: [user.id, user.name, user.email, mappedRole, userManagerId, user.designation || null],
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

  fastify.post('/api/sync', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    if (user.role !== 'Admin' && user.role !== 'Manager') {
      return reply.status(403).send({ error: 'Forbidden: Only managers and admins can sync the user directory' });
    }
    const { users } = request.body || {};
    if (!Array.isArray(users)) {
      return reply.status(400).send({ error: 'Invalid user directory payload' });
    }

    try {
      // 1. Fetch verified directory from portal to cross-reference roles and emails
      const verifiedUsersMap = new Map<string, any>();
      const managerIdsSet = new Set<string>();
      try {
        const workingUrl = await getWorkingPortalUrl();
        const targetUrl = `${workingUrl}/api/directory`;
        const res = await fetch(targetUrl, {
          method: 'GET',
          headers: {
            'x-forge-client-id': CLIENT_ID,
            'x-forge-client-secret': CLIENT_SECRET,
          },
        });
        if (res.ok) {
          const data = await res.json();
          for (const u of data.users || []) {
            verifiedUsersMap.set(u.id, u);
            if (u.manager_id || u.managerId) {
              managerIdsSet.add(u.manager_id || u.managerId);
            }
          }
        }
      } catch (err: any) {
        console.warn('Failed to fetch portal directory for sync validation:', err.message);
      }

      for (const u of users) {
        const id = u.id;
        const managerId = u.manager_id || u.managerId || null;

        // Verify user against portal data to prevent role forgery
        const verifiedUser = verifiedUsersMap.get(id);
        const name = verifiedUser ? verifiedUser.name : u.name;
        const email = verifiedUser ? verifiedUser.email : u.email;
        
        let role: 'Employee' | 'Manager' | 'Admin' = 'Employee';
        const portalRole = verifiedUser ? (verifiedUser.role || '').toLowerCase() : '';
        if (portalRole === 'super_admin' || portalRole === 'admin') {
          role = 'Admin';
        } else if (managerIdsSet.has(id)) {
          role = 'Manager';
        } else {
          // If not in portal directory, look up current local role to avoid down-grading local managers
          const currentLocalRes = await db.execute({
            sql: `SELECT role FROM users WHERE id = ?`,
            args: [id]
          });
          const localUser = currentLocalRes.rows?.[0] as any;
          if (localUser && (localUser.role === 'Manager' || localUser.role === 'Admin')) {
            role = localUser.role;
          }
        }

        // 2. Prevent circular manager reporting loops in local DB
        if (managerId) {
          const circularCheck = await db.execute({
            sql: `
              WITH RECURSIVE reporting_chain AS (
                SELECT id, manager_id FROM users WHERE id = ?
                UNION ALL
                SELECT u.id, u.manager_id
                FROM users u
                INNER JOIN reporting_chain rc ON rc.manager_id = u.id
              )
              SELECT 1 FROM reporting_chain WHERE id = ? LIMIT 1
            `,
            args: [managerId, id],
          });
          if (circularCheck.rows && circularCheck.rows.length > 0) {
            console.warn(`Circular reporting loop detected for user ${id} reporting to ${managerId}. Skipping manager association.`);
            continue;
          }
        }

        await db.execute({
          sql: `
            INSERT INTO users (id, name, email, role, manager_id, designation)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              email = excluded.email,
              role = excluded.role,
              manager_id = excluded.manager_id,
              designation = excluded.designation
          `,
          args: [id, name, email, role, managerId, u.designation || null],
        });
      }

      return { success: true, synced: users.length };
    } catch (err: any) {
      console.error('Sync failed:', err.message);
      return reply.status(500).send({ error: `Sync failed: ${err.message}` });
    }
  });

  fastify.get('/api/directory', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const { q, managerId } = (request.query as any) || {};

    try {
      const workingUrl = await getWorkingPortalUrl();
      const targetUrl = `${workingUrl}/api/directory`;
      const queryParams = new URLSearchParams();
      if (q) queryParams.append('q', q.toString());
      if (managerId) queryParams.append('managerId', managerId.toString());

      const fullUrl = `${targetUrl}?${queryParams.toString()}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'x-forge-client-id': CLIENT_ID,
          'x-forge-client-secret': CLIENT_SECRET,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const users = data.users || [];
        if (users.length > 0) {
          const managerIdsSet = new Set<string>();
          for (const u of users) {
            if (u.manager_id || u.managerId) {
              managerIdsSet.add(u.manager_id || u.managerId);
            }
          }
          // Perform database insertions asynchronously in the background
          Promise.resolve().then(async () => {
            for (const u of users) {
              const email = u.email;
              const id = u.id;
              const name = u.name;
              const managerId = u.manager_id || u.managerId || null;

              let role: 'Employee' | 'Manager' | 'Admin' = 'Employee';
              if (u.role === 'super_admin' || u.role === 'admin') {
                role = 'Admin';
              } else if (managerIdsSet.has(id)) {
                role = 'Manager';
              }

              try {
                await db.execute({
                  sql: `
                    INSERT INTO users (id, name, email, role, manager_id, designation)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                      name = excluded.name,
                      email = excluded.email,
                      role = CASE
                        WHEN users.role IN ('Manager', 'Admin') THEN users.role
                        ELSE excluded.role
                      END,
                      manager_id = COALESCE(excluded.manager_id, users.manager_id),
                      designation = COALESCE(excluded.designation, users.designation)
                  `,
                  args: [id, name, email, role, managerId, u.designation || null],
                });
              } catch (dbErr: any) {
                console.error('Background sync user write error:', dbErr.message);
              }
            }
          });
        }
        return reply.send(data);
      } else {
        const errText = await res.text();
        throw new Error(`Status ${res.status}: ${errText}`);
      }
    } catch (err: any) {
      console.error('All portal directory proxy requests failed, falling back to local database lookup:', err.message);
    }

    // Local SQLite database query fallback
    try {
      console.log('Falling back to local SQLite directory lookup...');
      let localRes;
      if (q) {
        const searchPattern = `%${q.trim()}%`;
        localRes = await db.execute({
          sql: `
            SELECT id, id as eid, name, email, role, manager_id, designation
            FROM users
            WHERE name LIKE ? OR email LIKE ? OR designation LIKE ?
            ORDER BY name ASC
            LIMIT 50
          `,
          args: [searchPattern, searchPattern, searchPattern],
        });
      } else if (managerId) {
        if (managerId === 'root') {
          localRes = await db.execute({
            sql: `
              SELECT id, id as eid, name, email, role, manager_id, designation
              FROM users
              WHERE manager_id IS NULL OR manager_id = ''
              ORDER BY name ASC
            `,
            args: [],
          });
        } else {
          localRes = await db.execute({
            sql: `
              SELECT id, id as eid, name, email, role, manager_id, designation
              FROM users
              WHERE manager_id = ?
              ORDER BY name ASC
            `,
            args: [managerId],
          });
        }
      } else {
        localRes = await db.execute({
          sql: `
            SELECT id, id as eid, name, email, role, manager_id, designation
            FROM users
            ORDER BY name ASC
          `,
          args: [],
        });
      }

      const users = localRes.rows.map((row: any) => ({
        id: row.id,
        eid: row.eid || row.id,
        name: row.name,
        email: row.email,
        role: row.role === 'Admin' ? 'admin' : (row.role === 'Manager' ? 'manager' : 'employee'),
        managerId: row.manager_id,
        manager_id: row.manager_id,
        designation: row.designation || '',
      }));

      return reply.send({ users, metadata: [] });
    } catch (dbErr: any) {
      console.error('Local directory lookup failed:', dbErr.message);
      return reply.status(502).send({ error: 'Failed to retrieve directory from portal or local database' });
    }
  });
}
