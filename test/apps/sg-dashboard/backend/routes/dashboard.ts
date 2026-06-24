import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { checkUplineManager } from '../utils/hierarchy';
import { CLIENT_ID, CLIENT_SECRET } from '../config';
import { getWorkingPortalUrl } from '../utils/portal';

export default async function dashboardRoutes(fastify: FastifyInstance) {
  // Get Current User's Dashboard
  fastify.get('/api/dashboard', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    try {
      let res = await db.execute({
        sql: `
          SELECT d.*, u.name, u.email, u.role
          FROM dashboards d
          LEFT JOIN users u ON d.user_id = u.id
          WHERE d.user_id = ?
        `,
        args: [user.id],
      });

      if (res.rows.length === 0) {
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

        res = await db.execute({
          sql: `
            SELECT d.*, u.name, u.email, u.role
            FROM dashboards d
            LEFT JOIN users u ON d.user_id = u.id
            WHERE d.user_id = ?
          `,
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

  // Get Specified Dashboard (View mode open to all authenticated users)
  fastify.get('/api/dashboard/:userId', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const targetUserId = request.params.userId;

    try {
      const res = await db.execute({
        sql: `
          SELECT d.*, u.name, u.email, u.role
          FROM dashboards d
          LEFT JOIN users u ON d.user_id = u.id
          WHERE d.user_id = ?
        `,
        args: [targetUserId],
      });

      if (res.rows.length === 0) {
        // Defensive check: ensure user exists to avoid FOREIGN KEY constraints
        const userCheck = await db.execute({
          sql: 'SELECT id FROM users WHERE id = ?',
          args: [targetUserId],
        });

        if (userCheck.rows.length === 0) {
          let dummyName = 'Employee';
          let dummyRole = 'Employee';
          try {
            const workingUrl = await getWorkingPortalUrl();
            const pRes = await fetch(`${workingUrl}/api/directory`, {
              headers: {
                'x-forge-client-id': CLIENT_ID,
                'x-forge-client-secret': CLIENT_SECRET,
              }
            });
            if (pRes.ok) {
              const pData = (await pRes.json()) as any;
              const found = pData.users?.find((u: any) => u.id === targetUserId);
              if (found) {
                dummyName = found.name;
                dummyRole = found.role === 'admin' || found.role === 'super_admin' ? 'Admin' : (found.role === 'manager' ? 'Manager' : 'Employee');
                await db.execute({
                  sql: 'INSERT INTO users (id, name, email, role, manager_id, designation) VALUES (?, ?, ?, ?, ?, ?)',
                  args: [found.id, found.name, found.email, dummyRole, found.managerId || null, found.designation || null],
                });
              }
            }
          } catch (err) {
            console.warn('Failed to auto-fetch missing user on dashboard query:', err);
          }

          // If still not inserted, insert stub user to avoid FK error
          const userCheckAfter = await db.execute({
            sql: 'SELECT id FROM users WHERE id = ?',
            args: [targetUserId],
          });
          if (userCheckAfter.rows.length === 0) {
            await db.execute({
              sql: 'INSERT INTO users (id, name, email, role, designation) VALUES (?, ?, ?, ?, ?)',
              args: [targetUserId, dummyName, `${targetUserId}@organization.local`, dummyRole, null],
            });
          }
        }

        const dashboardId = crypto.randomUUID();
        await db.execute({
          sql: 'INSERT INTO dashboards (id, user_id, program_line, objective, status, notes) VALUES (?, ?, ?, ?, ?, ?)',
          args: [
            dashboardId,
            targetUserId,
            'Engineering Strategy',
            'Optimize local resource utilization to achieve enterprise readiness within constraints.',
            'On Track',
            'Automatically initialized by manager review.',
          ],
        });

        const freshRes = await db.execute({
          sql: `
            SELECT d.*, u.name, u.email, u.role
            FROM dashboards d
            LEFT JOIN users u ON d.user_id = u.id
            WHERE d.user_id = ?
          `,
          args: [targetUserId],
        });
        const dashboard = freshRes.rows[0];
        return { dashboard, items: [] };
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

  // Update Dashboard Metadata (Owner only)
  fastify.put('/api/dashboard/:id', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    const dashboardId = request.params.id;
    const { program_line, objective, status, notes } = request.body || {};

    try {
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

  // Add Dashboard Item (Owner only)
  fastify.post('/api/dashboard/:id/items', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    const dashboardId = request.params.id;
    const { section, category, title, description, deadline } = request.body || {};

    if (!section || !title) {
      return reply.status(400).send({ error: 'Section and Title are required.' });
    }

    try {
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

  // Delete Dashboard Item (Owner only)
  fastify.delete('/api/dashboard/items/:itemId', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    const itemId = request.params.itemId;

    try {
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

  // Update Dashboard Item (Owner only)
  fastify.put('/api/dashboard/items/:itemId', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    const itemId = request.params.itemId;
    const { category, title, description, deadline } = request.body || {};

    try {
      const res = await db.execute({
        sql: `
          SELECT d.user_id, i.category, i.title, i.description, i.deadline
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
        return reply.status(403).send({ error: 'Forbidden: Only the owner can update this item' });
      }

      const current = res.rows[0];
      const newCategory = category !== undefined ? category : current.category;
      const newTitle = title !== undefined ? title : current.title;
      const newDescription = description !== undefined ? description : current.description;
      const newDeadline = deadline !== undefined ? deadline : current.deadline;

      await db.execute({
        sql: 'UPDATE dashboard_items SET category = ?, title = ?, description = ?, deadline = ? WHERE id = ?',
        args: [newCategory, newTitle, newDescription, newDeadline, itemId],
      });

      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
