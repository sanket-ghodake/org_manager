import { expect, test, describe, mock, spyOn, afterAll } from "bun:test";
import { executeAdminQuery } from "../../src/backend/api/admin/queryEngine";
import { db } from "../../src/database/connection";

// Mock the db.execute method
const mockExecute = spyOn(db, "execute").mockImplementation(async (sqlObj: any) => {
  return { rows: [{ result: "mocked" }], rowCount: 1 };
});

afterAll(() => {
  mockExecute.mockRestore();
});

describe("Administrative Query Engine Sandbox", () => {
  test("Allows read-only admin to execute safe SELECT queries", async () => {
    mockExecute.mockClear();
    const result = await executeAdminQuery("SELECT * FROM users;", "read_only_admin");
    expect(result).toBeDefined();
    expect(mockExecute).toHaveBeenCalled();
  });

  test("Blocks read-only admin from executing destructive queries (DROP)", async () => {
    mockExecute.mockClear();
    expect(
      executeAdminQuery("DROP TABLE users;", "read_only_admin")
    ).rejects.toThrow("Privilege Violation: Read-only accounts cannot run destructive queries.");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  test("Blocks read-only admin from executing destructive queries (DELETE)", async () => {
    mockExecute.mockClear();
    expect(
      executeAdminQuery("DELETE FROM users WHERE id = 1;", "read_only_admin")
    ).rejects.toThrow("Privilege Violation: Read-only accounts cannot run destructive queries.");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  test("Blocks read-only admin from executing destructive queries (ALTER)", async () => {
    mockExecute.mockClear();
    expect(
      executeAdminQuery("ALTER TABLE users ADD COLUMN age INT;", "read_only_admin")
    ).rejects.toThrow("Privilege Violation: Read-only accounts cannot run destructive queries.");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  test("Allows super_admin to execute destructive queries (DROP)", async () => {
    mockExecute.mockClear();
    const result = await executeAdminQuery("DROP TABLE temp_logs;", "super_admin");
    expect(result).toBeDefined();
    expect(mockExecute).toHaveBeenCalled();
  });

  test("Allows super_admin to execute safe SELECT queries", async () => {
    mockExecute.mockClear();
    const result = await executeAdminQuery("SELECT name FROM structural_metadata;", "super_admin");
    expect(result).toBeDefined();
    expect(mockExecute).toHaveBeenCalled();
  });
});
