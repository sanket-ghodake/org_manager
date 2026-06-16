import { expect, test, describe, mock } from "bun:test";

// Mock @backend/auth/sessionManager
mock.module("@backend/auth/sessionManager", () => {
  return {
    getSession: async () => {
      return {
        id: "admin-id",
        role: "admin",
        email: "admin@acmecorp.com"
      };
    },
    encryptSession: async (session: any) => {
      return "mocked-encrypted-session-token";
    }
  };
});

import { GET, POST } from "@frontend/app/api/auth/elevate/route";

describe("Sudo Elevation API Route Handler", () => {
  test("GET returns not elevated status by default", async () => {
    const req = new Request("http://localhost/api/auth/elevate");
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isElevated).toBe(false);
  });

  test("POST with invalid credentials rejects", async () => {
    const req = new Request("http://localhost/api/auth/elevate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "999999" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  test("POST with valid code (123456) elevates", async () => {
    const req = new Request("http://localhost/api/auth/elevate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "123456" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isElevated).toBe(true);
    
    // Verify response headers contain Set-Cookie header for session_token
    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toContain("session_token");
  });
});
