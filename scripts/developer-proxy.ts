// scripts/developer-proxy.ts
import { serve } from "bun";
import { Client } from "pg";

const PORT = 3003;
const TARGET = "http://localhost:3001";
const TARGET_WS = "ws://localhost:3001";

// Database client connection pool helper
let dbClient: Client | null = null;
async function getDbClient(): Promise<Client | null> {
  if (dbClient) return dbClient;
  try {
    const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/org_db';
    dbClient = new Client({ connectionString });
    await dbClient.connect();
    console.log("[Proxy DB] Connected to PostgreSQL successfully");
    return dbClient;
  } catch (err) {
    console.error("[Proxy DB] Connection failed:", err);
    dbClient = null;
    return null;
  }
}

// Resolve App Slug from various possible markers
async function resolveAppSlug(req: Request): Promise<string> {
  const url = new URL(req.url);

  // 1. Path-based check (e.g., /api/forge-apps/:slug or /forge-apps/:slug)
  const pathParts = url.pathname.split('/');
  const forgeAppsIdx = pathParts.findIndex(p => p === 'forge-apps');
  if (forgeAppsIdx !== -1 && pathParts[forgeAppsIdx + 1]) {
    return pathParts[forgeAppsIdx + 1];
  }

  // Database-backed checks
  const client = await getDbClient();
  if (client) {
    // 2. Authorization Bearer Token lookup
    const authHeader = req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      try {
        const res = await client.query(
          `SELECT a.slug 
           FROM forge_access_tokens t 
           JOIN forge_apps a ON t.app_id = a.id 
           WHERE t.access_token = $1 AND t.expires_at > NOW() 
           LIMIT 1`,
          [token]
        );
        if (res.rows.length > 0) {
          return res.rows[0].slug;
        }
      } catch (err) {
        console.error("[Proxy DB] Error resolving token to slug:", err);
      }
    }

    // 3. Referer/Origin check to match the sandbox container port
    const referer = req.headers.get('referer') || req.headers.get('origin') || '';
    if (referer) {
      try {
        const refUrl = new URL(referer);
        if (refUrl.port) {
          const portStr = `:${refUrl.port}`;
          const res = await client.query(
            `SELECT slug FROM forge_apps WHERE entry_url LIKE $2 OR redirect_uri LIKE $2 OR slug = $1 LIMIT 1`,
            [refUrl.hostname, `%${portStr}%`]
          );
          if (res.rows.length > 0) {
            return res.rows[0].slug;
          }
        }
      } catch (e) {
        // ignore invalid url
      }
    }

    // 4. Client ID lookup inside body for OAuth flows
    if (req.method === 'POST' && (url.pathname.endsWith('/auth/exchange') || url.pathname.endsWith('/token'))) {
      try {
        const reqClone = req.clone();
        const body = await reqClone.json();
        if (body && body.client_id) {
          const res = await client.query(
            `SELECT slug FROM forge_apps WHERE client_id = $1 LIMIT 1`,
            [body.client_id]
          );
          if (res.rows.length > 0) {
            return res.rows[0].slug;
          }
        }
      } catch (err) {
        // ignore parsing issues
      }
    }
  }

  // 5. Query parameters fallback
  const slugParam = url.searchParams.get('slug') || url.searchParams.get('app_slug') || url.searchParams.get('appSlug');
  if (slugParam) return slugParam;

  return 'unknown';
}

// Sanitize query parameters to redact sensitive inputs like email/IDs/keys
function sanitizeUrl(urlString: string): string {
  try {
    const url = new URL(urlString, "http://localhost");
    const params = new URLSearchParams(url.search);
    let updated = false;

    for (const [key, val] of params.entries()) {
      const isEmail = val.includes("@") && val.includes(".");
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val);
      const isNumericId = /^\d+$/.test(val) && val.length > 2;
      const keyLower = key.toLowerCase();
      const isSensitiveKey = 
        keyLower.includes("id") || 
        keyLower.includes("email") || 
        keyLower.includes("user") || 
        keyLower.includes("token") || 
        keyLower.includes("key") || 
        keyLower.includes("pass") || 
        keyLower.includes("secret") || 
        keyLower.includes("auth") ||
        keyLower.includes("code");

      if (isEmail || isUuid || isNumericId || isSensitiveKey) {
        params.set(key, "[REDACTED]");
        updated = true;
      }
    }

    const queryStr = params.toString();
    return url.pathname + (queryStr ? "?" + queryStr : "");
  } catch (err) {
    return urlString;
  }
}

// SSE telemetry client connections map
const telemetryClients = new Map<number, ReadableStreamDefaultController>();

function broadcastTelemetryEvent(event: any) {
  const data = JSON.stringify(event);
  const packet = new TextEncoder().encode(`data: ${data}\n\n`);
  for (const [id, controller] of telemetryClients.entries()) {
    try {
      controller.enqueue(packet);
    } catch (e) {
      telemetryClients.delete(id);
    }
  }
}

serve<{ pathname: string; search: string; upstreamWs?: WebSocket }>({
  port: PORT,
  hostname: "0.0.0.0",
  async fetch(req, server) {
    const url = new URL(req.url);

    // 1. Expose CORS Preflight OPTIONS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    // 2. Expose the Telemetry Proxy SSE Stream locally
    if (req.method === 'GET' && url.pathname === '/api/telemetry/proxy-stream') {
      if (server && typeof server.timeout === 'function') {
        server.timeout(req, 0); // Disable connection idle timeout
      }
      const stream = new ReadableStream({
        start(controller) {
          const clientId = Date.now();
          telemetryClients.set(clientId, controller);
          
          const pingInterval = setInterval(() => {
            try {
              controller.enqueue(new TextEncoder().encode(": ping\n\n"));
            } catch (e) {
              telemetryClients.delete(clientId);
              clearInterval(pingInterval);
            }
          }, 15000);

          req.signal.addEventListener('abort', () => {
            telemetryClients.delete(clientId);
            clearInterval(pingInterval);
          });
        },
        cancel() {
          // clean up
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
        }
      });
    }

    // Handle WebSocket upgrade for Next.js HMR
    if (req.headers.get("upgrade") === "websocket") {
      const success = server.upgrade(req, {
        data: {
          pathname: url.pathname,
          search: url.search,
        },
      });
      if (success) return undefined;
    }

    let pathname = url.pathname;
    if (pathname === "/" || pathname === "") {
      pathname = "/developer";
    }

    const targetUrl = new URL(pathname + url.search, TARGET);

    // Clone request headers and update Host to target server
    const headers = new Headers(req.headers);
    headers.set("host", "localhost:3001");
    headers.set("x-from-developer-proxy", "true");

    const hasBody = !["GET", "HEAD"].includes(req.method) && req.body;

    // Measure request size (via content-length header or cloned body)
    let requestSize = parseInt(req.headers.get("content-length") || "0", 10);
    if (hasBody && requestSize === 0) {
      try {
        const reqClone = req.clone();
        const buf = await reqClone.arrayBuffer();
        requestSize = buf.byteLength;
      } catch (e) {
        // ignore
      }
    }

    const start = Date.now();
    let appSlug = 'unknown';
    const isApiRequest = (url.pathname.startsWith('/api/') || url.pathname.includes('/forge-apps/')) && url.pathname !== '/api/telemetry/proxy-stream';

    if (isApiRequest) {
      try {
        appSlug = await resolveAppSlug(req);
      } catch (err) {
        console.error("Failed to resolve app slug:", err);
      }
    }

    try {
      const response = await fetch(targetUrl.toString(), {
        method: req.method,
        headers: headers,
        body: hasBody ? req.body : undefined,
        redirect: "manual",
      });

      // Forward response headers and status
      const resHeaders = new Headers(response.headers);
      resHeaders.delete("content-encoding");
      resHeaders.delete("content-length");
      resHeaders.delete("transfer-encoding");
      
      // Rewrite any absolute redirects pointing to port 3001 back to 3003
      let location = resHeaders.get("location");
      if (location) {
        if (location.includes("localhost:3001")) {
          location = location.replace("localhost:3001", `localhost:${PORT}`);
        }
        
        // If a redirect is trying to route the user to login, direct them back to developer
        const redirectUrl = new URL(location, `http://localhost:${PORT}`);
        if (redirectUrl.pathname === "/login" || redirectUrl.pathname === "/") {
          location = `http://localhost:${PORT}/developer`;
        }
        
        resHeaders.set("location", location);
      }

      // Read response body as buffer to count size and forward safely
      const resBody = await response.arrayBuffer();
      const responseSize = resBody.byteLength;
      const latencyMs = Date.now() - start;

      // Log telemetry if it's an API request
      if (isApiRequest) {
        const sanitizedRoute = sanitizeUrl(url.pathname + url.search);
        const telemetryEvent = {
          appSlug,
          endpointRoute: sanitizedRoute,
          httpMethod: req.method,
          statusCode: response.status,
          latencyMs,
          payloadSizeBytes: requestSize + responseSize,
          timestamp: Date.now(),
        };
        broadcastTelemetryEvent(telemetryEvent);
      }

      return new Response(resBody, {
        status: response.status,
        headers: resHeaders,
      });
    } catch (err) {
      console.error("[Proxy Error]:", err);
      return new Response("Proxy error connecting to upstream portal server", { status: 502 });
    }
  },
  websocket: {
    open(ws) {
      const upstreamUrl = `${TARGET_WS}${ws.data.pathname}${ws.data.search}`;
      const upstreamWs = new WebSocket(upstreamUrl);
      ws.data.upstreamWs = upstreamWs;

      upstreamWs.onmessage = (event) => {
        if (ws.readyState === 1) { // OPEN
          ws.send(event.data);
        }
      };

      upstreamWs.onclose = () => {
        ws.close();
      };

      upstreamWs.onerror = (err) => {
        console.error("[Proxy Upstream WebSocket Error]:", err);
      };
    },
    message(ws, message) {
      if (ws.data.upstreamWs && ws.data.upstreamWs.readyState === 1) {
        ws.data.upstreamWs.send(message);
      }
    },
    close(ws) {
      if (ws.data.upstreamWs) {
        ws.data.upstreamWs.close();
      }
    },
  },
});

console.log(`Developer Proxy Server listening on port ${PORT} -> forwarding to ${TARGET}`);
