import { expect, test, describe } from "bun:test";
import { getSession } from "../../src/backend/auth/sessionManager";

describe("Stateless Session Manager", () => {
  test("Returns null if session_token cookie is missing", async () => {
    const mockRequest = {
      cookies: {
        get: (name: string) => {
          if (name === "session_token") return null;
          return null;
        }
      }
    } as any;

    const session = await getSession(mockRequest);
    expect(session).toBeNull();
  });

  test("Returns null if session_token cookie is malformed", async () => {
    const mockRequest = {
      cookies: {
        get: (name: string) => {
          if (name === "session_token") return { value: "invalid-base64-string!!!" };
          return null;
        }
      }
    } as any;

    const session = await getSession(mockRequest);
    expect(session).toBeNull();
  });

  test("Returns decoded UserSession when session_token is valid", async () => {
    const expectedUser = {
      id: "abc-123",
      eid: "E0001",
      email: "test@acmecorp.com",
      name: "Test User",
      role: "user",
      isPasswordChanged: true,
    };
    const base64Value = Buffer.from(JSON.stringify(expectedUser)).toString("base64");

    const mockRequest = {
      cookies: {
        get: (name: string) => {
          if (name === "session_token") return { value: base64Value };
          return null;
        }
      }
    } as any;

    const session = await getSession(mockRequest);
    expect(session).toEqual(expectedUser);
  });
});
