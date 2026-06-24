import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { checkUplineManager } from '../utils/hierarchy';
import { CLIENT_ID, CLIENT_SECRET } from '../config';
import { getWorkingPortalUrl } from '../utils/portal';
import crypto from 'crypto';

export default async function dashboardRoutes(fastify: FastifyInstance) {
  // Get List of All Dashboards for a User
  fastify.get('/api/dashboards', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    const targetUserId = (request.query as any).userId || user.id;

    try {
      const res = await db.execute({
        sql: `
          SELECT id, program_line, updated_at
          FROM dashboards
          WHERE user_id = ?
          ORDER BY updated_at DESC
        `,
        args: [targetUserId],
      });
      return { dashboards: res.rows };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Get Current User's Dashboard
  fastify.get('/api/dashboard', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    const queryDashboardId = (request.query as any).dashboardId;

    try {
      let res: any = null;
      if (queryDashboardId) {
        res = await db.execute({
          sql: `
            SELECT d.*, u.name, u.email, u.role, u.designation
            FROM dashboards d
            LEFT JOIN users u ON d.user_id = u.id
            WHERE d.id = ? AND d.user_id = ?
          `,
          args: [queryDashboardId, user.id],
        });
      }

      if (!queryDashboardId || !res || res.rows.length === 0) {
        res = await db.execute({
          sql: `
            SELECT d.*, u.name, u.email, u.role, u.designation
            FROM dashboards d
            LEFT JOIN users u ON d.user_id = u.id
            WHERE d.user_id = ?
            ORDER BY d.updated_at DESC
          `,
          args: [user.id],
        });
      }

      if (!res || res.rows.length === 0) {
        const dashboardId = crypto.randomUUID();
        await db.execute({
          sql: 'INSERT INTO dashboards (id, user_id, program_line, objective, notes) VALUES (?, ?, ?, ?, ?)',
          args: [
            dashboardId,
            user.id,
            'AI/ML Enablement',
            'Accelerate technical excellence and lead delivery on AI/ML Enablement deliverables.',
            'Automatically created upon initial login.',
          ],
        });

        res = await db.execute({
          sql: `
            SELECT d.*, u.name, u.email, u.role, u.designation
            FROM dashboards d
            LEFT JOIN users u ON d.user_id = u.id
            WHERE d.id = ?
          `,
          args: [dashboardId],
        });
      }

      const dashboard = res?.rows[0];
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
    const queryDashboardId = (request.query as any).dashboardId;

    try {
      let res: any = null;
      if (queryDashboardId) {
        res = await db.execute({
          sql: `
            SELECT d.*, u.name, u.email, u.role, u.designation
            FROM dashboards d
            LEFT JOIN users u ON d.user_id = u.id
            WHERE d.id = ? AND d.user_id = ?
          `,
          args: [queryDashboardId, targetUserId],
        });
      }

      if (!queryDashboardId || !res || res.rows.length === 0) {
        res = await db.execute({
          sql: `
            SELECT d.*, u.name, u.email, u.role, u.designation
            FROM dashboards d
            LEFT JOIN users u ON d.user_id = u.id
            WHERE d.user_id = ?
            ORDER BY d.updated_at DESC
          `,
          args: [targetUserId],
        });
      }

      if (!res || res.rows.length === 0) {
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
          sql: 'INSERT INTO dashboards (id, user_id, program_line, objective, notes) VALUES (?, ?, ?, ?, ?)',
          args: [
            dashboardId,
            targetUserId,
            'AI/ML Enablement',
            'Accelerate technical excellence and lead delivery on AI/ML Enablement deliverables.',
            'Automatically initialized by manager review.',
          ],
        });

        const freshRes = await db.execute({
          sql: `
            SELECT d.*, u.name, u.email, u.role, u.designation
            FROM dashboards d
            LEFT JOIN users u ON d.user_id = u.id
            WHERE d.id = ?
          `,
          args: [dashboardId],
        });
        const dashboard = freshRes.rows[0];
        return { dashboard, items: [] };
      }

      const dashboard = res?.rows[0];
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
    const { program_line, objective, notes } = request.body || {};

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
          SET program_line = ?, objective = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        args: [program_line || 'Default Program', objective || '', notes || '', dashboardId],
      });

      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Get Suggestions for autocomplete (based on organizational data)
  fastify.get('/api/suggestions', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const section = (request.query as any).section;
    if (!section || !['key_skill', 'gap', 'training_plan'].includes(section)) {
      return reply.status(400).send({ error: 'Valid section ("key_skill", "gap", "training_plan") is required.' });
    }
    try {
      const res = await db.execute({
        sql: 'SELECT DISTINCT title FROM dashboard_items WHERE section = ? ORDER BY title ASC',
        args: [section],
      });
      return { suggestions: res.rows.map((row: any) => row.title) };
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

  // Create New Dashboard
  fastify.post('/api/dashboard', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    const { program_line } = request.body || {};

    try {
      const newDashboardId = crypto.randomUUID();
      const pName = (program_line && program_line.trim()) || 'New Program';

      await db.execute({
        sql: 'INSERT INTO dashboards (id, user_id, program_line, objective, notes) VALUES (?, ?, ?, ?, ?)',
        args: [
          newDashboardId,
          user.id,
          pName,
          'Accelerate technical excellence and lead delivery on deliverables.',
          'Successfully initialized.'
        ]
      });

      return { success: true, newDashboardId, newProgramName: pName };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Duplicate Dashboard
  fastify.post('/api/dashboard/:id/duplicate', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    const dashboardId = request.params.id;

    try {
      const dashRes = await db.execute({
        sql: 'SELECT * FROM dashboards WHERE id = ?',
        args: [dashboardId]
      });

      if (dashRes.rows.length === 0) {
        return reply.status(404).send({ error: 'Dashboard not found' });
      }

      const original = dashRes.rows[0];
      if (original.user_id !== user.id) {
        return reply.status(403).send({ error: 'Forbidden: Only the owner can duplicate this dashboard' });
      }

      const newDashboardId = crypto.randomUUID();
      const newProgramName = `${original.program_line || 'Default Program'} (Copy)`;

      await db.execute({
        sql: 'INSERT INTO dashboards (id, user_id, program_line, objective, notes) VALUES (?, ?, ?, ?, ?)',
        args: [
          newDashboardId,
          user.id,
          newProgramName,
          original.objective,
          original.notes
        ]
      });

      const itemsRes = await db.execute({
        sql: 'SELECT * FROM dashboard_items WHERE dashboard_id = ?',
        args: [dashboardId]
      });

      for (const item of itemsRes.rows) {
        const newItemId = crypto.randomUUID();
        await db.execute({
          sql: 'INSERT INTO dashboard_items (id, dashboard_id, section, category, title, description, deadline) VALUES (?, ?, ?, ?, ?, ?, ?)',
          args: [newItemId, newDashboardId, item.section, item.category, item.title, item.description, item.deadline]
        });
      }

      return { success: true, newDashboardId, newProgramName };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Delete Dashboard
  fastify.delete('/api/dashboard/:id', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    const dashboardId = request.params.id;

    try {
      const dashRes = await db.execute({
        sql: 'SELECT user_id FROM dashboards WHERE id = ?',
        args: [dashboardId]
      });

      if (dashRes.rows.length === 0) {
        return reply.status(404).send({ error: 'Dashboard not found' });
      }

      if (dashRes.rows[0].user_id !== user.id) {
        return reply.status(403).send({ error: 'Forbidden: Only the owner can delete this dashboard' });
      }

      const countRes = await db.execute({
        sql: 'SELECT COUNT(*) as count FROM dashboards WHERE user_id = ?',
        args: [user.id]
      });

      const count = countRes.rows[0].count as number;
      if (count <= 1) {
        return reply.status(400).send({ error: 'Cannot delete your only dashboard. You must have at least one program.' });
      }

      await db.execute({
        sql: 'DELETE FROM dashboards WHERE id = ?',
        args: [dashboardId]
      });

      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
