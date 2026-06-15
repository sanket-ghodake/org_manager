// scripts/developer-proxy.ts
import { serve } from "bun";

const PORT = 3003;
const TARGET = "http://localhost:3001";
const TARGET_WS = "ws://localhost:3001";

serve<{ pathname: string; search: string; upstreamWs?: WebSocket }>({
  port: PORT,
  async fetch(req, server) {
    const url = new URL(req.url);

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

    // Don't pass GET/HEAD body to fetch (which causes errors in some runtimes)
    const hasBody = !["GET", "HEAD"].includes(req.method) && req.body;

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

      return new Response(response.body, {
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
