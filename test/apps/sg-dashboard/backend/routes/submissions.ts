import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { checkUplineManager } from '../utils/hierarchy';
import crypto from 'crypto';


async function autoSubmitExpiredRequests() {
  const nowStr = new Date().toISOString().split('T')[0];
  try {
    // Find all Pending submission requests where the deadline has passed (is in the past)
    const expired = await db.execute({
      sql: "SELECT id, employee_id, deadline FROM submission_requests WHERE status = 'Pending' AND deadline < ?",
      args: [nowStr]
    });
    
    for (const req of expired.rows) {
      // Find the employee's active dashboard
      const dashRes = await db.execute({
        sql: "SELECT id FROM dashboards WHERE user_id = ? AND is_deleted = 0 ORDER BY updated_at DESC LIMIT 1",
        args: [req.employee_id]
      });
      
      const dashboardId = dashRes.rows[0]?.id || null;
      
      // Auto-submit the request with the deadline as the submitted date
      await db.execute({
        sql: "UPDATE submission_requests SET status = 'Submitted', submitted_at = ?, dashboard_id = ? WHERE id = ?",
        args: [req.deadline + 'T23:59:59Z', dashboardId, req.id]
      });
      console.log(`[AUTO-SUBMIT] Request ${req.id} for employee ${req.employee_id} was automatically submitted because the deadline ${req.deadline} has passed.`);
    }
  } catch (err: any) {
    console.error('Error auto-submitting expired requests:', err.message);
  }
}

export default async function submissionsRoutes(fastify: FastifyInstance) {
  // Get Submissions Requests (Employee)
  fastify.get('/api/submissions', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    const { employeeId } = (request.query as any) || {};
    const targetUserId = employeeId || user.id;
    
    // Process any expired pending submission requests
    await autoSubmitExpiredRequests();

    try {
      const res = await db.execute({
        sql: `
          SELECT s.*, u.name as manager_name, d.program_line as dashboard_program
          FROM submission_requests s
          JOIN users u ON s.manager_id = u.id
          LEFT JOIN dashboards d ON s.dashboard_id = d.id
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
    const { employee_id, deadline, dashboard_id } = request.body || {};

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

      const immediateManagerId = (empRes.rows[0] as any).manager_id;
      const isUpline = await checkUplineManager(user.id, employee_id);
      if (immediateManagerId !== user.id && !isUpline && user.role !== 'Admin') {
        return reply.status(403).send({ error: 'Forbidden: You can only request submissions from your reporting line.' });
      }

      const submissionId = crypto.randomUUID();
      await db.execute({
        sql: 'INSERT INTO submission_requests (id, manager_id, employee_id, dashboard_id, deadline, status) VALUES (?, ?, ?, ?, ?, ?)',
        args: [submissionId, user.id, employee_id, dashboard_id || null, deadline, 'Pending'],
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

  // Direct Self-Initiated Submission (Employee)
  fastify.post('/api/submissions/direct', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    const { dashboard_id } = request.body || {};

    if (!dashboard_id) {
      return reply.status(400).send({ error: 'dashboard_id is required.' });
    }

    try {
      // Find employee's manager
      const empRes = await db.execute({
        sql: 'SELECT manager_id FROM users WHERE id = ?',
        args: [user.id],
      });

      let managerId = null;
      if (empRes.rows.length > 0) {
        managerId = (empRes.rows[0] as any).manager_id;
      }

      // If no manager is assigned, find any Manager or fallback to self
      if (!managerId) {
        const mgrRes = await db.execute({
          sql: "SELECT id FROM users WHERE role = 'Manager' LIMIT 1",
          args: []
        });
        if (mgrRes.rows.length > 0) {
          managerId = (mgrRes.rows[0] as any).id;
        } else {
          managerId = user.id;
        }
      }

      // Check if there is already an existing submission request for this dashboard
      const existing = await db.execute({
        sql: "SELECT id FROM submission_requests WHERE employee_id = ? AND dashboard_id = ? ORDER BY deadline DESC LIMIT 1",
        args: [user.id, dashboard_id]
      });

      let requestId = null;
      if (existing.rows.length > 0) {
        requestId = (existing.rows[0] as any).id;
        const nowStrFull = new Date().toISOString();
        await db.execute({
          sql: "UPDATE submission_requests SET status = 'Submitted', submitted_at = ? WHERE id = ?",
          args: [nowStrFull, requestId]
        });
      } else {
        requestId = crypto.randomUUID();
        const nowStrFull = new Date().toISOString();
        const defaultDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        await db.execute({
          sql: "INSERT INTO submission_requests (id, manager_id, employee_id, dashboard_id, deadline, status, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          args: [requestId, managerId, user.id, dashboard_id, defaultDeadline, 'Submitted', nowStrFull]
        });
      }

      return { success: true, submissionId: requestId };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });


  // Submit Dashboard (Employee)
  fastify.post('/api/submissions/:id/submit', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    const requestId = request.params.id;
    const { dashboard_id } = request.body || {};

    // Process any expired pending submission requests first
    await autoSubmitExpiredRequests();

    try {
      // Verify ownership of the request
      const reqRes = await db.execute({
        sql: 'SELECT employee_id, deadline, status FROM submission_requests WHERE id = ?',
        args: [requestId],
      });

      if (reqRes.rows.length === 0) {
        return reply.status(404).send({ error: 'Submission request not found.' });
      }

      const row = reqRes.rows[0] as any;
      if (row.employee_id !== user.id) {
        return reply.status(403).send({ error: 'Forbidden: Only the assigned employee can submit.' });
      }

      // Check if deadline has passed
      const nowStr = new Date().toISOString().split('T')[0];
      if (row.deadline < nowStr) {
        return reply.status(400).send({ error: 'Submission deadline has passed and this request is frozen. Your last active dashboard version has been locked for review.' });
      }

      if (row.status !== 'Pending' && row.status !== 'Needs Revision') {
        return reply.status(400).send({ error: 'This request is already submitted or approved.' });
      }

      // Update status to Submitted with current date and link the submitted dashboard
      const nowStrFull = new Date().toISOString();
      await db.execute({
        sql: "UPDATE submission_requests SET status = 'Submitted', submitted_at = ?, dashboard_id = ? WHERE id = ?",
        args: [nowStrFull, dashboard_id || null, requestId],
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
    
    // Process any expired pending submission requests
    await autoSubmitExpiredRequests();

    try {
      const res = await db.execute({
        sql: `
          SELECT s.*, u.name as employee_name, u.email as employee_email, u.role as employee_role, u.designation as employee_designation,
                 d.program_line as dashboard_program
          FROM submission_requests s
          JOIN users u ON s.employee_id = u.id
          LEFT JOIN dashboards d ON s.dashboard_id = d.id
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

      const row = reqRes.rows[0] as any;
      if (row.manager_id !== user.id && user.role !== 'Admin') {
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
      console.log(`\x1b[35m[ALERT] Real-time notification sent to dots: Your SG Dashboard plan has been reviewed by ${user.name}. Status: ${status}. Feedback: "${feedback || 'None'}".\x1b[0m`);

      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Freeze Submission Request (Manager or Admin)
  fastify.post('/api/submissions/:id/freeze', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    const requestId = request.params.id;

    try {
      const reqRes = await db.execute({
        sql: 'SELECT manager_id, employee_id, status FROM submission_requests WHERE id = ?',
        args: [requestId],
      });

      if (reqRes.rows.length === 0) {
        return reply.status(404).send({ error: 'Submission request not found.' });
      }

      const row = reqRes.rows[0] as any;
      if (row.manager_id !== user.id && user.role !== 'Admin') {
        return reply.status(403).send({ error: 'Forbidden: You can only freeze submissions assigned to you.' });
      }

      if (row.status !== 'Pending') {
        return reply.status(400).send({ error: 'Only pending submission requests can be frozen.' });
      }

      // Find the employee's active dashboard
      const dashRes = await db.execute({
        sql: "SELECT id FROM dashboards WHERE user_id = ? AND is_deleted = 0 ORDER BY updated_at DESC LIMIT 1",
        args: [row.employee_id]
      });
      const dashboardId = dashRes.rows[0]?.id || null;

      // Auto-submit the request as of today
      const nowStr = new Date().toISOString();
      await db.execute({
        sql: "UPDATE submission_requests SET status = 'Submitted', submitted_at = ?, dashboard_id = ? WHERE id = ?",
        args: [nowStr, dashboardId, requestId],
      });

      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
