import { expect, test, describe, spyOn, beforeAll, afterAll } from "bun:test";
import { middleware } from "@backend/middleware/authGuard";
import { NextResponse } from "next/server";
import { encryptSession } from "@backend/auth/sessionManager";

describe("Middleware Authentication Guard Pipeline", () => {
  let originalFetch: typeof fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
    // Mock global fetch to prevent actual network calls in tests
    global.fetch = async (input: any, init: any) => {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    };
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test("Redirects to /login if there is no session token", async () => {
    const mockRequest = {
      url: "http://localhost:3000/dashboard",
      nextUrl: {
        pathname: "/dashboard",
      },
      headers: {
        get: (name: string) => "127.0.0.1",
      },
      cookies: {
        get: (name: string) => null,
      },
    } as any;

    const response = await middleware(mockRequest);
    expect(response).toBeDefined();
    expect(response.status).toBe(307); // Temporary Redirect
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  test("Redirects to /force-reset if password is not changed and path is not /force-reset", async () => {
    const expectedUser = {
      id: "abc-123",
      eid: "E0001",
      email: "test@sgforge.com",
      name: "Test User",
      role: "user",
      isPasswordChanged: false, // Password reset required
    };
    const jwtValue = await encryptSession(expectedUser);

    const mockRequest = {
      url: "http://localhost:3000/dashboard",
      nextUrl: {
        pathname: "/dashboard",
      },
      headers: {
        get: (name: string) => "127.0.0.1",
      },
      cookies: {
        get: (name: string) => {
          if (name === "session_token") return { value: jwtValue };
          return null;
        },
      },
    } as any;

    const fetchSpy = spyOn(global, "fetch");

    try {
      const response = await middleware(mockRequest);
      expect(response).toBeDefined();
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/force-reset");
      expect(fetchSpy).toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  test("Allows request to proceed if password is changed", async () => {
    const expectedUser = {
      id: "abc-123",
      eid: "E0001",
      email: "test@sgforge.com",
      name: "Test User",
      role: "user",
      isPasswordChanged: true, // Password already changed
    };
    const jwtValue = await encryptSession(expectedUser);

    const mockRequest = {
      url: "http://localhost:3000/dashboard",
      nextUrl: {
        pathname: "/dashboard",
      },
      headers: {
        get: (name: string) => "127.0.0.1",
      },
      cookies: {
        get: (name: string) => {
          if (name === "session_token") return { value: jwtValue };
          return null;
        },
      },
    } as any;

    const response = await middleware(mockRequest);
    expect(response).toBeDefined();
    // In Next.js middleware, a successful pass-through response will return a status 200 or an internal Next rewrite
    expect(response.status).toBe(200);
  });

  test("Allows public access to /developer route without a session when request has proxy header", async () => {
    const mockRequest = {
      url: "http://localhost:3000/developer",
      nextUrl: {
        pathname: "/developer",
      },
      headers: {
        get: (name: string) => {
          if (name === "x-from-developer-proxy") return "true";
          return "127.0.0.1";
        },
      },
      cookies: {
        get: (name: string) => null,
      },
    } as any;

    const response = await middleware(mockRequest);
    expect(response).toBeDefined();
    expect(response.status).toBe(200);
  });

  test("Redirects direct /developer access to port 3003", async () => {
    const mockRequest = {
      url: "http://localhost:3001/developer",
      nextUrl: {
        pathname: "/developer",
      },
      headers: {
        get: (name: string) => null,
      },
      cookies: {
        get: (name: string) => null,
      },
    } as any;

    const response = await middleware(mockRequest);
    expect(response).toBeDefined();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3003/");
  });

  test("Allows public access to /api/apps without a session", async () => {
    const mockRequest = {
      url: "http://localhost:3000/api/apps",
      nextUrl: {
        pathname: "/api/apps",
      },
      headers: {
        get: (name: string) => "127.0.0.1",
      },
      cookies: {
        get: (name: string) => null,
      },
    } as any;

    const response = await middleware(mockRequest);
    expect(response).toBeDefined();
    expect(response.status).toBe(200);
  });

  test("Allows public access to GET /api/admin/metadata without a session", async () => {
    const mockRequest = {
      url: "http://localhost:3000/api/admin/metadata",
      nextUrl: {
        pathname: "/api/admin/metadata",
      },
      method: "GET",
      headers: {
        get: (name: string) => "127.0.0.1",
      },
      cookies: {
        get: (name: string) => null,
      },
    } as any;

    const response = await middleware(mockRequest);
    expect(response).toBeDefined();
    expect(response.status).toBe(200);
  });
});

