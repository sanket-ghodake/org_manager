import { FastifyInstance } from 'fastify';
import { db } from '../db/client';

export default async function teamRoutes(fastify: FastifyInstance) {
  fastify.get('/api/team', { preValidation: [fastify.authenticate] }, async (request: any, reply) => {
    const user = request.user;
    const { managerId, rootsOnly } = (request.query as any) || {};

    try {
      let sql = '';
      let args: any[] = [];

      const selectFields = `
        u.id, u.name, u.email, u.role, u.manager_id, u.designation,
        d.id AS dashboard_id, d.updated_at AS dashboard_updated_at,
        s.status AS last_submission_status, s.deadline AS last_submission_deadline
      `;

      const subqueryJoin = `
        LEFT JOIN dashboards d ON d.user_id = u.id
        LEFT JOIN (
          SELECT employee_id, status, deadline,
                 ROW_NUMBER() OVER (PARTITION BY employee_id ORDER BY deadline DESC) as rn
          FROM submission_requests
        ) s ON s.employee_id = u.id AND s.rn = 1
      `;

      if (managerId) {
        // View mode open to all authenticated users
        sql = `
          SELECT ${selectFields}
          FROM users u
          ${subqueryJoin}
          WHERE u.manager_id = ?
          ORDER BY u.name ASC
        `;
        args = [managerId];
      } else {
        if (user.role === 'Admin') {
          if (rootsOnly === 'true') {
            sql = `
              SELECT ${selectFields}
              FROM users u
              ${subqueryJoin}
              WHERE u.manager_id IS NULL OR u.manager_id = ''
              ORDER BY u.name ASC
            `;
            args = [];
          } else {
            // Admin sees everyone
            sql = `
              SELECT ${selectFields}
              FROM users u
              ${subqueryJoin}
              WHERE u.id != ?
              ORDER BY u.name ASC
            `;
            args = [user.id];
          }
        } else {
          if (rootsOnly === 'true') {
            sql = `
              SELECT ${selectFields}
              FROM users u
              ${subqueryJoin}
              WHERE u.manager_id = ?
              ORDER BY u.name ASC
            `;
            args = [user.id];
          } else {
            // Managers see direct and indirect reports (recursive manager chain)
            sql = `
              WITH RECURSIVE reports AS (
                SELECT id, name, email, role, manager_id, designation
                FROM users
                WHERE manager_id = ?
                UNION ALL
                SELECT u.id, u.name, u.email, u.role, u.manager_id, u.designation
                FROM users u
                JOIN reports r ON u.manager_id = r.id
              )
              SELECT DISTINCT 
                u.id, u.name, u.email, u.role, u.manager_id, u.designation,
                d.id AS dashboard_id, d.updated_at AS dashboard_updated_at,
                s.status AS last_submission_status, s.deadline AS last_submission_deadline
              FROM reports u
              LEFT JOIN dashboards d ON d.user_id = u.id
              LEFT JOIN (
                SELECT employee_id, status, deadline,
                       ROW_NUMBER() OVER (PARTITION BY employee_id ORDER BY deadline DESC) as rn
                FROM submission_requests
              ) s ON s.employee_id = u.id AND s.rn = 1
              ORDER BY u.name ASC
            `;
            args = [user.id];
          }
        }
      }

      const res = await db.execute({ sql, args });

      const teamData = res.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        managerId: row.manager_id,
        designation: row.designation || '',
        hasDashboard: row.dashboard_id !== null && row.dashboard_id !== undefined,
        dashboardId: row.dashboard_id || null,
        dashboardUpdatedAt: row.dashboard_updated_at || null,
        lastSubmissionStatus: row.last_submission_status || null,
        lastSubmissionDeadline: row.last_submission_deadline || null,
      }));

      return { team: teamData };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
