import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { checkUplineManager } from '../utils/hierarchy';

export default async function dashboardRoutes(fastify: FastifyInstance) {
  // Get Current User's Dashboard
  fastify.get('/api/dashboard', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    try {
      let res = await db.execute({
        sql: 'SELECT * FROM dashboards WHERE user_id = ?',
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

  // Get Specified Dashboard (Hierarchy protected)
  fastify.get('/api/dashboard/:userId', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const currentUser = request.user;
    const targetUserId = request.params.userId;

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
