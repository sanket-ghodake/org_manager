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
    const includeDeleted = (request.query as any).includeDeleted === 'true';

    try {
      const sql = includeDeleted
        ? `
          SELECT d.id, d.program_line, d.is_deleted, d.updated_at,
                 s.id as last_submission_id,
                 s.status as last_submission_status,
                 s.submitted_at as last_submission_date,
                 s.feedback as last_submission_feedback,
                 s.deadline as last_submission_deadline
          FROM dashboards d
          LEFT JOIN (
            SELECT id, dashboard_id, status, submitted_at, feedback, deadline,
                   ROW_NUMBER() OVER (PARTITION BY dashboard_id ORDER BY COALESCE(submitted_at, deadline) DESC) as rn
            FROM submission_requests
          ) s ON s.dashboard_id = d.id AND s.rn = 1
          WHERE d.user_id = ?
          ORDER BY d.is_deleted ASC, d.updated_at DESC
        `
        : `
          SELECT d.id, d.program_line, d.is_deleted, d.updated_at,
                 s.id as last_submission_id,
                 s.status as last_submission_status,
                 s.submitted_at as last_submission_date,
                 s.feedback as last_submission_feedback,
                 s.deadline as last_submission_deadline
          FROM dashboards d
          LEFT JOIN (
            SELECT id, dashboard_id, status, submitted_at, feedback, deadline,
                   ROW_NUMBER() OVER (PARTITION BY dashboard_id ORDER BY COALESCE(submitted_at, deadline) DESC) as rn
            FROM submission_requests
          ) s ON s.dashboard_id = d.id AND s.rn = 1
          WHERE d.user_id = ? AND d.is_deleted = 0
          ORDER BY d.updated_at DESC
        `;
      const res = await db.execute({
        sql,
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
            SELECT d.*, u.name, u.email, u.role, u.designation,
                   s.status AS last_submission_status
            FROM dashboards d
            LEFT JOIN users u ON d.user_id = u.id
            LEFT JOIN (
              SELECT dashboard_id, status,
                     ROW_NUMBER() OVER (PARTITION BY dashboard_id ORDER BY COALESCE(submitted_at, deadline) DESC) as rn
              FROM submission_requests
            ) s ON s.dashboard_id = d.id AND s.rn = 1
            WHERE d.id = ? AND d.user_id = ?
          `,
          args: [queryDashboardId, user.id],
        });
      }

      if (!queryDashboardId || !res || res.rows.length === 0) {
        res = await db.execute({
          sql: `
            SELECT d.*, u.name, u.email, u.role, u.designation,
                   s.status AS last_submission_status
            FROM dashboards d
            LEFT JOIN users u ON d.user_id = u.id
            LEFT JOIN (
              SELECT dashboard_id, status,
                     ROW_NUMBER() OVER (PARTITION BY dashboard_id ORDER BY COALESCE(submitted_at, deadline) DESC) as rn
              FROM submission_requests
            ) s ON s.dashboard_id = d.id AND s.rn = 1
            WHERE d.user_id = ? AND d.is_deleted = 0
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
            SELECT d.*, u.name, u.email, u.role, u.designation,
                   s.status AS last_submission_status
            FROM dashboards d
            LEFT JOIN users u ON d.user_id = u.id
            LEFT JOIN (
              SELECT dashboard_id, status,
                     ROW_NUMBER() OVER (PARTITION BY dashboard_id ORDER BY COALESCE(submitted_at, deadline) DESC) as rn
              FROM submission_requests
            ) s ON s.dashboard_id = d.id AND s.rn = 1
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
      const linksRes = await db.execute({
        sql: 'SELECT * FROM dashboard_item_links WHERE dashboard_id = ?',
        args: [dashboard.id],
      });

      return { dashboard, items: itemsRes.rows, links: linksRes.rows };
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
            SELECT d.*, u.name, u.email, u.role, u.designation,
                   s.status AS last_submission_status
            FROM dashboards d
            LEFT JOIN users u ON d.user_id = u.id
            LEFT JOIN (
              SELECT dashboard_id, status,
                     ROW_NUMBER() OVER (PARTITION BY dashboard_id ORDER BY COALESCE(submitted_at, deadline) DESC) as rn
              FROM submission_requests
            ) s ON s.dashboard_id = d.id AND s.rn = 1
            WHERE d.id = ? AND d.user_id = ?
          `,
          args: [queryDashboardId, targetUserId],
        });
      }

      if (!queryDashboardId || !res || res.rows.length === 0) {
        res = await db.execute({
          sql: `
            SELECT d.*, u.name, u.email, u.role, u.designation,
                   s.status AS last_submission_status
            FROM dashboards d
            LEFT JOIN users u ON d.user_id = u.id
            LEFT JOIN (
              SELECT dashboard_id, status,
                     ROW_NUMBER() OVER (PARTITION BY dashboard_id ORDER BY COALESCE(submitted_at, deadline) DESC) as rn
              FROM submission_requests
            ) s ON s.dashboard_id = d.id AND s.rn = 1
            WHERE d.user_id = ? AND d.is_deleted = 0
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
            SELECT d.*, u.name, u.email, u.role, u.designation,
                   s.status AS last_submission_status
            FROM dashboards d
            LEFT JOIN users u ON d.user_id = u.id
            LEFT JOIN (
              SELECT dashboard_id, status,
                     ROW_NUMBER() OVER (PARTITION BY dashboard_id ORDER BY COALESCE(submitted_at, deadline) DESC) as rn
              FROM submission_requests
            ) s ON s.dashboard_id = d.id AND s.rn = 1
            WHERE d.id = ?
          `,
          args: [dashboardId],
        });
        const dashboard = freshRes.rows[0];
        return { dashboard, items: [], links: [] };
      }

      const dashboard = res?.rows[0];
      const itemsRes = await db.execute({
        sql: 'SELECT * FROM dashboard_items WHERE dashboard_id = ?',
        args: [dashboard.id],
      });
      const linksRes = await db.execute({
        sql: 'SELECT * FROM dashboard_item_links WHERE dashboard_id = ?',
        args: [dashboard.id],
      });

      return { dashboard, items: itemsRes.rows, links: linksRes.rows };
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
    const { section, category, title, description, deadline, status, target_quarter, completed_quarter } = request.body || {};

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
        sql: 'INSERT INTO dashboard_items (id, dashboard_id, section, category, title, description, deadline, status, target_quarter, completed_quarter) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [itemId, dashboardId, section, category || '', title, description || '', deadline || '', status || 'not_started', target_quarter || null, completed_quarter || null],
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
    const { category, title, description, deadline, status, target_quarter, completed_quarter } = request.body || {};

    try {
      const res = await db.execute({
        sql: `
          SELECT d.user_id, i.category, i.title, i.description, i.deadline, i.status, i.target_quarter, i.completed_quarter
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
      const newStatus = status !== undefined ? status : current.status;
      const newTargetQuarter = target_quarter !== undefined ? target_quarter : current.target_quarter;
      const newCompletedQuarter = completed_quarter !== undefined ? completed_quarter : current.completed_quarter;

      await db.execute({
        sql: 'UPDATE dashboard_items SET category = ?, title = ?, description = ?, deadline = ?, status = ?, target_quarter = ?, completed_quarter = ? WHERE id = ?',
        args: [newCategory, newTitle, newDescription, newDeadline, newStatus, newTargetQuarter, newCompletedQuarter, itemId],
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

      await db.execute('BEGIN TRANSACTION');

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

      const itemIdMap = new Map<string, string>();
      for (const item of itemsRes.rows) {
        const newItemId = crypto.randomUUID();
        itemIdMap.set(item.id as string, newItemId);
        await db.execute({
          sql: 'INSERT INTO dashboard_items (id, dashboard_id, section, category, title, description, deadline, status, target_quarter, completed_quarter) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          args: [newItemId, newDashboardId, item.section, item.category, item.title, item.description, item.deadline, item.status, item.target_quarter, item.completed_quarter]
        });
      }

      // Clone links mapping old item IDs to new item IDs
      const linksRes = await db.execute({
        sql: 'SELECT * FROM dashboard_item_links WHERE dashboard_id = ?',
        args: [dashboardId]
      });

      for (const link of linksRes.rows) {
        const newSourceId = itemIdMap.get(link.source_id as string);
        const newTargetId = itemIdMap.get(link.target_id as string);
        if (newSourceId && newTargetId) {
          const newLinkId = crypto.randomUUID();
          await db.execute({
            sql: 'INSERT INTO dashboard_item_links (id, dashboard_id, source_id, target_id) VALUES (?, ?, ?, ?)',
            args: [newLinkId, newDashboardId, newSourceId, newTargetId]
          });
        }
      }

      await db.execute('COMMIT');
      return { success: true, newDashboardId, newProgramName };
    } catch (err: any) {
      try {
        await db.execute('ROLLBACK');
      } catch (e) {}
      return reply.status(500).send({ error: err.message });
    }
  });

  // Sync Item Links (Owner only)
  fastify.post('/api/dashboard/:id/links', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    const dashboardId = request.params.id;
    const { source_id, target_ids } = request.body || {};

    if (!source_id || !Array.isArray(target_ids)) {
      return reply.status(400).send({ error: 'source_id and target_ids array are required.' });
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
        return reply.status(403).send({ error: 'Forbidden' });
      }

      // Sync links in transaction
      await db.execute('BEGIN TRANSACTION');

      // Delete old links
      await db.execute({
        sql: 'DELETE FROM dashboard_item_links WHERE dashboard_id = ? AND source_id = ?',
        args: [dashboardId, source_id],
      });

      // Insert new links
      for (const targetId of target_ids) {
        const linkId = crypto.randomUUID();
        await db.execute({
          sql: 'INSERT INTO dashboard_item_links (id, dashboard_id, source_id, target_id) VALUES (?, ?, ?, ?)',
          args: [linkId, dashboardId, source_id, targetId],
        });
      }

      await db.execute('COMMIT');
      return { success: true };
    } catch (err: any) {
      try {
        await db.execute('ROLLBACK');
      } catch (e) {}
      return reply.status(500).send({ error: err.message });
    }
  });

  // Delete Dashboard (Soft Delete)
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
        sql: 'SELECT COUNT(*) as count FROM dashboards WHERE user_id = ? AND is_deleted = 0',
        args: [user.id]
      });

      const count = countRes.rows[0].count as number;
      if (count <= 1) {
        return reply.status(400).send({ error: 'Cannot delete your only dashboard. You must have at least one program.' });
      }

      await db.execute({
        sql: 'UPDATE dashboards SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
        args: [dashboardId]
      });

      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Get List of Soft-Deleted Dashboards for a User
  fastify.get('/api/dashboards/history', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    try {
      const res = await db.execute({
        sql: `
          SELECT id, program_line, updated_at, deleted_at
          FROM dashboards
          WHERE user_id = ? AND is_deleted = 1
          ORDER BY updated_at DESC
        `,
        args: [user.id],
      });
      return { dashboards: res.rows };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Restore Soft-Deleted Dashboard
  fastify.post('/api/dashboard/:id/restore', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    const dashboardId = request.params.id;

    try {
      const ownerRes = await db.execute({
        sql: 'SELECT user_id FROM dashboards WHERE id = ?',
        args: [dashboardId],
      });
      if (ownerRes.rows.length === 0) return reply.status(404).send({ error: 'Dashboard not found' });
      if (ownerRes.rows[0].user_id !== user.id) return reply.status(403).send({ error: 'Forbidden' });

      await db.execute({
        sql: 'UPDATE dashboards SET is_deleted = 0, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        args: [dashboardId]
      });

      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Delete Dashboard Permanently
  fastify.delete('/api/dashboard/:id/permanent', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    const dashboardId = request.params.id;

    try {
      const ownerRes = await db.execute({
        sql: 'SELECT user_id FROM dashboards WHERE id = ?',
        args: [dashboardId],
      });
      if (ownerRes.rows.length === 0) return reply.status(404).send({ error: 'Dashboard not found' });
      if (ownerRes.rows[0].user_id !== user.id) return reply.status(403).send({ error: 'Forbidden' });

      await db.execute({
        sql: 'DELETE FROM dashboards WHERE id = ?',
        args: [dashboardId]
      });

      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Create Saved Version of Dashboard
  fastify.post('/api/dashboard/:id/versions', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    const dashboardId = request.params.id;
    const { version_name } = request.body || {};

    try {
      // Check ownership
      const ownerRes = await db.execute({
        sql: 'SELECT user_id, program_line, objective, notes FROM dashboards WHERE id = ?',
        args: [dashboardId],
      });
      if (ownerRes.rows.length === 0) return reply.status(404).send({ error: 'Dashboard not found' });
      if (ownerRes.rows[0].user_id !== user.id) return reply.status(403).send({ error: 'Forbidden' });

      const dash = ownerRes.rows[0];

      // Fetch items and links
      const itemsRes = await db.execute({
        sql: 'SELECT * FROM dashboard_items WHERE dashboard_id = ?',
        args: [dashboardId],
      });
      const linksRes = await db.execute({
        sql: 'SELECT * FROM dashboard_item_links WHERE dashboard_id = ?',
        args: [dashboardId],
      });

      const snapshot = {
        program_line: dash.program_line,
        objective: dash.objective,
        notes: dash.notes,
        items: itemsRes.rows,
        links: linksRes.rows
      };

      const versionId = crypto.randomUUID();
      const name = version_name && version_name.trim() ? version_name.trim() : `Snapshot - ${new Date().toLocaleString()}`;

      await db.execute({
        sql: 'INSERT INTO dashboard_versions (id, dashboard_id, version_name, snapshot) VALUES (?, ?, ?, ?)',
        args: [versionId, dashboardId, name, JSON.stringify(snapshot)]
      });

      return { success: true, versionId, version_name: name };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // List Versions for Dashboard
  fastify.get('/api/dashboard/:id/versions', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    const dashboardId = request.params.id;

    try {
      // Check ownership
      const ownerRes = await db.execute({
        sql: 'SELECT user_id FROM dashboards WHERE id = ?',
        args: [dashboardId],
      });
      if (ownerRes.rows.length === 0) return reply.status(404).send({ error: 'Dashboard not found' });
      if (ownerRes.rows[0].user_id !== user.id) return reply.status(403).send({ error: 'Forbidden' });

      const res = await db.execute({
        sql: 'SELECT id, version_name, created_at FROM dashboard_versions WHERE dashboard_id = ? ORDER BY created_at DESC',
        args: [dashboardId]
      });

      return { versions: res.rows };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Restore Dashboard Version
  fastify.post('/api/dashboard/:id/versions/:versionId/restore', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    const dashboardId = request.params.id;
    const versionId = request.params.versionId;

    try {
      // Check ownership
      const ownerRes = await db.execute({
        sql: 'SELECT user_id FROM dashboards WHERE id = ?',
        args: [dashboardId],
      });
      if (ownerRes.rows.length === 0) return reply.status(404).send({ error: 'Dashboard not found' });
      if (ownerRes.rows[0].user_id !== user.id) return reply.status(403).send({ error: 'Forbidden' });

      // Fetch version
      const verRes = await db.execute({
        sql: 'SELECT snapshot FROM dashboard_versions WHERE id = ? AND dashboard_id = ?',
        args: [versionId, dashboardId]
      });
      if (verRes.rows.length === 0) return reply.status(404).send({ error: 'Version not found' });

      const snapshot = JSON.parse(verRes.rows[0].snapshot as string);

      await db.execute('BEGIN TRANSACTION');

      // Delete current items and links
      await db.execute({
        sql: 'DELETE FROM dashboard_item_links WHERE dashboard_id = ?',
        args: [dashboardId]
      });
      await db.execute({
        sql: 'DELETE FROM dashboard_items WHERE dashboard_id = ?',
        args: [dashboardId]
      });

      // Update metadata
      await db.execute({
        sql: 'UPDATE dashboards SET program_line = ?, objective = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        args: [snapshot.program_line || 'Default Program', snapshot.objective || '', snapshot.notes || '', dashboardId]
      });

      // Insert items
      if (Array.isArray(snapshot.items)) {
        for (const item of snapshot.items) {
          await db.execute({
            sql: 'INSERT INTO dashboard_items (id, dashboard_id, section, category, title, description, deadline, status, target_quarter, completed_quarter) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            args: [item.id, dashboardId, item.section, item.category, item.title, item.description, item.deadline, item.status, item.target_quarter, item.completed_quarter]
          });
        }
      }

      // Insert links
      if (Array.isArray(snapshot.links)) {
        for (const link of snapshot.links) {
          await db.execute({
            sql: 'INSERT INTO dashboard_item_links (id, dashboard_id, source_id, target_id) VALUES (?, ?, ?, ?)',
            args: [link.id || crypto.randomUUID(), dashboardId, link.source_id, link.target_id]
          });
        }
      }

      await db.execute('COMMIT');
      return { success: true };
    } catch (err: any) {
      try { await db.execute('ROLLBACK'); } catch (e) {}
      return reply.status(500).send({ error: err.message });
    }
  });

  // Delete Dashboard Version
  fastify.delete('/api/dashboard/:id/versions/:versionId', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    const dashboardId = request.params.id;
    const versionId = request.params.versionId;

    try {
      // Check ownership
      const ownerRes = await db.execute({
        sql: 'SELECT user_id FROM dashboards WHERE id = ?',
        args: [dashboardId],
      });
      if (ownerRes.rows.length === 0) return reply.status(404).send({ error: 'Dashboard not found' });
      if (ownerRes.rows[0].user_id !== user.id) return reply.status(403).send({ error: 'Forbidden' });

      await db.execute({
        sql: 'DELETE FROM dashboard_versions WHERE id = ? AND dashboard_id = ?',
        args: [versionId, dashboardId]
      });

      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
