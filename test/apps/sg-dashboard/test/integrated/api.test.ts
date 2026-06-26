// Set test environment and test database URL before importing anything
(process.env as any).NODE_ENV = "test";
process.env.DATABASE_URL = "file:volume/test_integration.db";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { db, initDb } from "../../backend/db/client";
import { fastify } from "../../backend/server";

describe("SG Dashboard API Integration Tests", () => {
  let userToken: string;
  let testUser: any;
  let baseUrl: string;

  beforeAll(async () => {
    // Initialize test DB and seed data
    await initDb();

    // Start fastify on a random port
    baseUrl = await fastify.listen({ port: 0, host: "127.0.0.1" });

    // Retrieve a seeded user from the test database to sign a valid JWT token
    const usersRes = await db.execute(
      "SELECT id, name, role, email FROM users LIMIT 1",
    );
    if (usersRes.rows.length === 0) {
      throw new Error("No users seeded in the integration test database");
    }
    testUser = usersRes.rows[0];

    userToken = fastify.jwt.sign({
      id: testUser.id,
      eid: testUser.id,
      name: testUser.name,
      email: testUser.email,
      role: testUser.role,
    });
  });

  afterAll(async () => {
    // Close fastify instance
    await fastify.close();
    // Close db connection
    db.close();

    // Clean up test database files
    const dbPaths = [
      path.join(__dirname, "../../volume/test_integration.db"),
      path.join(__dirname, "../../volume/test_integration.db-shm"),
      path.join(__dirname, "../../volume/test_integration.db-wal"),
    ];
    for (const p of dbPaths) {
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch (_e) {
          // Ignore delete errors
        }
      }
    }
  });

  it("GET /api/config should return Client ID and SSO URL", async () => {
    const res = await fetch(`${baseUrl}/api/config`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.clientId).toBeDefined();
    expect(body.portalSsoUrl).toBeDefined();
  });

  it("GET /api/dashboards without auth token should return 401 Unauthorized", async () => {
    const res = await fetch(`${baseUrl}/api/dashboards`);
    expect(res.status).toBe(401);
  });

  it("GET /api/dashboards with valid auth token should return dashboards list", async () => {
    const res = await fetch(`${baseUrl}/api/dashboards`, {
      headers: {
        authorization: `Bearer ${userToken}`,
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.dashboards).toBeArray();
  });

  it("GET /api/dashboard with valid auth token should return the dashboard layout and items", async () => {
    const res = await fetch(`${baseUrl}/api/dashboard`, {
      headers: {
        authorization: `Bearer ${userToken}`,
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.dashboard).toBeDefined();
    expect(body.dashboard.user_id).toBe(testUser.id);
    expect(body.items).toBeArray();
    expect(body.links).toBeArray();
  });

  it("GET /api/suggestions with valid auth token should return category suggestions", async () => {
    const res = await fetch(`${baseUrl}/api/suggestions?section=key_skill`, {
      headers: {
        authorization: `Bearer ${userToken}`,
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.suggestions).toBeArray();
  });
});
