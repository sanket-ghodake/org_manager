import { db } from '../../database/connection';
import { sql } from 'drizzle-orm';
import { spawn } from 'child_process';

const PORT = 3002;
const AUTH_PASSWORD = 'password123';
const COOKIE_NAME = 'dev_session';
const COOKIE_VALUE = 'authenticated_sunil_dev';

let lastTestRun: {
  passed: number;
  failed: number;
  timestamp: string;
  rawOutput: string;
} | null = null;

function isAuthenticated(req: Request): boolean {
  const cookieHeader = req.headers.get('cookie') || '';
  return cookieHeader.includes(`${COOKIE_NAME}=${COOKIE_VALUE}`);
}

export async function handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // Serve static dashboard CSS/JS assets before auth checks
    if (url.pathname === '/dashboard.css') {
      const file = Bun.file(import.meta.dir + '/dashboard.css');
      return new Response(file, {
        headers: { 'Content-Type': 'text/css' },
      });
    }
    if (url.pathname === '/dashboard.js') {
      const file = Bun.file(import.meta.dir + '/dashboard.js');
      return new Response(file, {
        headers: { 'Content-Type': 'application/javascript' },
      });
    }

    // 1. POST /api/auth - Login Handler
    if (req.method === 'POST' && url.pathname === '/api/auth') {
      try {
        const body = await req.json();
        if (body.password === AUTH_PASSWORD) {
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Set-Cookie': `${COOKIE_NAME}=${COOKIE_VALUE}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`,
            },
          });
        }
        return new Response(JSON.stringify({ error: 'Incorrect password' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: 'Invalid request payload' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 2. POST /api/logout - Logout Handler
    if (req.method === 'POST' && url.pathname === '/api/logout') {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`,
        },
      });
    }

    // --- All subsequent routes require authentication ---
    if (!isAuthenticated(req)) {
      // For API endpoints, return a 401 status code
      if (url.pathname.startsWith('/api/')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Serve the HTML file directly so it shows the login screen
      const htmlFile = Bun.file(import.meta.dir + '/dashboard.html');
      const htmlContent = await htmlFile.text();
      return new Response(htmlContent, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // 3. GET / - Serves Dashboard HTML
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const htmlFile = Bun.file(import.meta.dir + '/dashboard.html');
      const htmlContent = await htmlFile.text();
      return new Response(htmlContent, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // 4. GET /api/status - Dashboard overview state
    if (req.method === 'GET' && url.pathname === '/api/status') {
      try {
        // Fetch total table count and logs count
        const tablesRes = await db.execute(sql`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        `);
        const tables = tablesRes.rows || tablesRes;

        const logsCountRes = await db.execute(sql`SELECT count(*)::integer FROM system_logs;`);
        const logsCount = logsCountRes.rows?.[0]?.count ?? logsCountRes[0]?.count ?? 0;

        // Compile data for each table (name, row counts, key columns)
        const tablesOverview = [];
        for (const t of tables) {
          const tableName = t.table_name;
          
          // Get row count
          const countRes = await db.execute(sql.raw(`SELECT count(*)::integer FROM "${tableName}"`));
          const rows = countRes.rows?.[0]?.count ?? countRes[0]?.count ?? 0;

          // Get primary keys or key columns
          const keyColsRes = await db.execute(sql.raw(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = '${tableName}' AND table_schema = 'public' 
            LIMIT 3
          `));
          const keyColumns = (keyColsRes.rows || keyColsRes).map((c: any) => c.column_name);

          tablesOverview.push({
            name: tableName,
            rows,
            keyColumns
          });
        }

        return new Response(
          JSON.stringify({
            tableCount: tables.length,
            logsCount,
            lastTestRun,
            tables: tablesOverview,
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 5. GET /api/tables - Table Details Metadata Explorer
    if (req.method === 'GET' && url.pathname === '/api/tables') {
      try {
        const tablesRes = await db.execute(sql`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        `);
        const tables = tablesRes.rows || tablesRes;
        
        const tablesOverview = [];
        for (const t of tables) {
          const tableName = t.table_name;
          
          // Row count
          const countRes = await db.execute(sql.raw(`SELECT count(*)::integer FROM "${tableName}"`));
          const rows = countRes.rows?.[0]?.count ?? countRes[0]?.count ?? 0;

          // Columns
          const colsRes = await db.execute(sql.raw(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = '${tableName}' AND table_schema = 'public'
            ORDER BY ordinal_position
          `));
          const columns = (colsRes.rows || colsRes).map((c: any) => ({
            name: c.column_name,
            type: c.data_type
          }));

          tablesOverview.push({
            name: tableName,
            rows,
            columns
          });
        }

        return new Response(JSON.stringify({ tables: tablesOverview }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 6. GET /api/logs - Fetch audit logs with optional search & severity filter
    if (req.method === 'GET' && url.pathname === '/api/logs') {
      try {
        const search = url.searchParams.get('search') || '';
        const severity = url.searchParams.get('severity') || '';

        let queryText = `
          SELECT l.id, l.user_id as "userId", l.action, l.severity, l.payload, l.ip_address as "ipAddress", l.timestamp, u.name as user_name 
          FROM system_logs l 
          LEFT JOIN users u ON l.user_id = u.id
        `;

        const conditions: string[] = [];
        if (severity && severity !== 'ALL') {
          const cleanSeverity = ['INFO', 'WARN', 'ERROR', 'CRITICAL'].includes(severity) ? severity : 'INFO';
          conditions.push(`l.severity = '${cleanSeverity}'`);
        }
        if (search) {
          const cleanSearch = search.replace(/'/g, "''");
          conditions.push(`(l.action ILIKE '%${cleanSearch}%' OR l.payload::text ILIKE '%${cleanSearch}%' OR u.name ILIKE '%${cleanSearch}%')`);
        }

        if (conditions.length > 0) {
          queryText += ' WHERE ' + conditions.join(' AND ');
        }

        queryText += ' ORDER BY l.timestamp DESC LIMIT 200';

        const logsRes = await db.execute(sql.raw(queryText));
        const logs = logsRes.rows || logsRes;

        return new Response(JSON.stringify({ logs }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 7. POST /api/query - SQL Query Runner console
    if (req.method === 'POST' && url.pathname === '/api/query') {
      try {
        const body = await req.json();
        const queryText = body.query || '';
        
        if (!queryText.trim()) {
          return new Response(JSON.stringify({ error: 'SQL query cannot be empty' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Execute raw query using drizzle connection
        const result = await db.execute(sql.raw(queryText));
        
        return new Response(
          JSON.stringify({
            rows: result.rows || result,
            rowCount: result.rowCount ?? (Array.isArray(result) ? result.length : 0),
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 8. POST /api/run-tests - Trigger test pipeline
    if (req.method === 'POST' && url.pathname === '/api/run-tests') {
      try {
        const testResult = await new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
          const child = spawn('bun', ['test', 'test/'], {
            env: {
              ...process.env,
              PATH: `${process.cwd()}/portables/bun/bin:${process.cwd()}/portables/postgres/bin:${process.env.PATH}`,
            },
          });

          let stdout = '';
          let stderr = '';

          child.stdout.on('data', (data) => {
            stdout += data.toString();
          });

          child.stderr.on("data", (data) => {
            stderr += data.toString();
          });

          child.on('close', (code) => {
            resolve({ stdout, stderr, code: code ?? 0 });
          });
        });

        const output = testResult.stderr || testResult.stdout;
        
        // Parse tests stats from the test runner output
        const passMatch = output.match(/(\d+)\s+pass/);
        const failMatch = output.match(/(\d+)\s+fail/);
        const passed = passMatch ? parseInt(passMatch[1], 10) : 0;
        const failed = failMatch ? parseInt(failMatch[1], 10) : 0;

        lastTestRun = {
          passed,
          failed,
          timestamp: new Date().toISOString(),
          rawOutput: output,
        };

        return new Response(
          JSON.stringify({
            success: true,
            passed,
            failed,
            rawOutput: output,
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Fallback: 404 Not Found
    return new Response('Not Found', { status: 404 });
}

if (import.meta.main) {
  const server = Bun.serve({
    port: PORT,
    fetch: handleRequest,
  });
  console.log(`🚀 Developer Dashboard Server active at http://localhost:${PORT}`);
}
