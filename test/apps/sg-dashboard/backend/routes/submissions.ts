import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { checkUplineManager } from '../utils/hierarchy';

export default async function submissionsRoutes(fastify: FastifyInstance) {
  // Get Submissions Requests (Employee)
  fastify.get('/api/submissions', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    const { employeeId } = (request.query as any) || {};
    const targetUserId = employeeId || user.id;
    try {
      const res = await db.execute({
        sql: `
          SELECT s.*, u.name as manager_name
          FROM submission_requests s
          JOIN users u ON s.manager_id = u.id
          WHERE s.employee_id = ?
          ORDER BY s.deadline DESC
        `,
        args: [targetUserId],
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
      const isUpline = await checkUplineManager(user.id, employee_id);
      if (immediateManagerId !== user.id && !isUpline && user.role !== 'Admin') {
        return reply.status(403).send({ error: 'Forbidden: You can only request submissions from your reporting line.' });
      }

      const submissionId = crypto.randomUUID();
      await db.execute({
        sql: 'INSERT INTO submission_requests (id, manager_id, employee_id, deadline, status) VALUES (?, ?, ?, ?, ?)',
        args: [submissionId, user.id, employee_id, deadline, 'Pending'],
      });

      // Query employee info for notification mock
      const empInfo = await db.execute({
        sql: 'SELECT name, email FROM users WHERE id = ?',
        args: [employee_id]
      });
      const employeeName = empInfo.rows[0]?.name || 'Employee';
      console.log(`\x1b[35m[ALERT] Real-time email alert sent to ${employeeName} (${employee_id}): Manager ${user.name} has requested a new SG Dashboard plan submission with deadline ${deadline}.\x1b[0m`);

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

      // Update status to Submitted with current date
      const nowStr = new Date().toISOString().split('T')[0];
      await db.execute({
        sql: 'UPDATE submission_requests SET status = "Submitted", submitted_at = ? WHERE id = ?',
        args: [nowStr, requestId],
      });

      // Send simulated real-time alert to the manager
      const mgrCheck = await db.execute({
        sql: 'SELECT u.name, u.email FROM submission_requests s JOIN users u ON s.manager_id = u.id WHERE s.id = ?',
        args: [requestId],
      });
      const managerName = mgrCheck.rows[0]?.name || 'Manager';
      console.log(`\x1b[35m[ALERT] Real-time chat notification sent to ${managerName}: Employee ${user.name} has submitted their SG Dashboard plan for review.\x1b[0m`);

      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Get Reviews Queue (Manager view of reports submissions)
  fastify.get('/api/submissions/reviews', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    try {
      const res = await db.execute({
        sql: `
          SELECT s.*, u.name as employee_name, u.email as employee_email, u.role as employee_role, u.designation as employee_designation,
                 d.status as dashboard_status
          FROM submission_requests s
          JOIN users u ON s.employee_id = u.id
          LEFT JOIN dashboards d ON d.user_id = u.id
          WHERE s.manager_id = ?
          ORDER BY s.deadline DESC
        `,
        args: [user.id],
      });
      return { reviews: res.rows };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Review Submission (Manager approval or revision request)
  fastify.post('/api/submissions/:id/review', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    const requestId = request.params.id;
    const { status, feedback } = (request.body as any) || {};

    if (!status || !['Approved', 'Needs Revision'].includes(status)) {
      return reply.status(400).send({ error: 'Valid status ("Approved" or "Needs Revision") is required.' });
    }

    try {
      // Verify manager owns this request (or user is Admin)
      const reqRes = await db.execute({
        sql: 'SELECT manager_id, employee_id FROM submission_requests WHERE id = ?',
        args: [requestId],
      });

      if (reqRes.rows.length === 0) {
        return reply.status(404).send({ error: 'Submission request not found.' });
      }

      if (reqRes.rows[0].manager_id !== user.id && user.role !== 'Admin') {
        return reply.status(403).send({ error: 'Forbidden: You can only review submissions assigned to you.' });
      }

      const nowStr = new Date().toISOString().split('T')[0];
      await db.execute({
        sql: 'UPDATE submission_requests SET status = ?, feedback = ?, reviewed_at = ? WHERE id = ?',
        args: [status, feedback || '', nowStr, requestId],
      });

      // Send simulated real-time alert to employee
      const empCheck = await db.execute({
        sql: 'SELECT u.name, u.email FROM users u JOIN submission_requests s ON s.employee_id = u.id WHERE s.id = ?',
        args: [requestId],
      });
      const employeeName = empCheck.rows[0]?.name || 'Employee';
      console.log(`\x1b[35m[ALERT] Real-time notification sent to ${employeeName}: Your SG Dashboard plan has been reviewed by ${user.name}. Status: ${status}. Feedback: "${feedback || 'None'}".\x1b[0m`);

      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
