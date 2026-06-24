import { FastifyInstance } from 'fastify';
import { db } from '../db/client';

export default async function teamRoutes(fastify: FastifyInstance) {
  fastify.get('/api/team', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    const { managerId, rootsOnly } = (request.query as any) || {};

    try {
      let reportsRes;
      if (managerId) {
        // View mode open to all authenticated users
        reportsRes = await db.execute({
          sql: 'SELECT id, name, email, role, manager_id FROM users WHERE manager_id = ? ORDER BY name ASC',
          args: [managerId],
        });
      } else {
        if (user.role === 'Admin') {
          if (rootsOnly === 'true') {
            reportsRes = await db.execute({
              sql: `
                SELECT id, name, email, role, manager_id 
                FROM users 
                WHERE manager_id IS NULL OR manager_id = ''
                ORDER BY name ASC
              `,
              args: [],
            });
          } else {
            // Admin sees everyone
            reportsRes = await db.execute({
              sql: 'SELECT id, name, email, role, manager_id FROM users WHERE id != ? ORDER BY name ASC',
              args: [user.id],
            });
          }
        } else {
          if (rootsOnly === 'true') {
            reportsRes = await db.execute({
              sql: 'SELECT id, name, email, role, manager_id FROM users WHERE manager_id = ? ORDER BY name ASC',
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
        }
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
}
