import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { CLIENT_ID, CLIENT_SECRET, PORTAL_INTERNAL_URL } from '../config';

export default async function authRoutes(fastify: FastifyInstance) {
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

  fastify.post('/api/sync', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const { users } = request.body || {};
    if (!Array.isArray(users)) {
      return reply.status(400).send({ error: 'Invalid user directory payload' });
    }

    try {
      const managerIdsSet = new Set<string>();
      for (const u of users) {
        if (u.manager_id || u.managerId) {
          managerIdsSet.add(u.manager_id || u.managerId);
        }
      }

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
}
