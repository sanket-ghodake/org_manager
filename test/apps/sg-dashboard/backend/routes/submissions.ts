import { FastifyInstance } from 'fastify';
import { db } from '../db/client';

export default async function submissionsRoutes(fastify: FastifyInstance) {
  // Get Submissions Requests (Employee)
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

  // Create Submission Request (Manager -> Report only)
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

  // Submit Dashboard (Employee)
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
}
