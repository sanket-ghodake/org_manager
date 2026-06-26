import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { db } from "../../backend/db/client";
import { checkUplineManager } from "../../backend/utils/hierarchy";

describe("hierarchy utility unit tests", () => {
  let originalFetch: any;
  let originalExecute: any;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalExecute = db.execute;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    db.execute = originalExecute;
  });

  it("should return true if portal returns isUpline: true", async () => {
    global.fetch = mock(() => {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ isUpline: true }),
      });
    }) as any;

    const result = await checkUplineManager("mgr-1", "emp-1");
    expect(result).toBe(true);
  });

  it("should return false if portal returns isUpline: false", async () => {
    global.fetch = mock(() => {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ isUpline: false }),
      });
    }) as any;

    const result = await checkUplineManager("mgr-1", "emp-1");
    expect(result).toBe(false);
  });

  it("should fall back to local database query if fetch fails and return true if manager found", async () => {
    global.fetch = mock(() => {
      return Promise.reject(new Error("Network failure"));
    }) as any;

    db.execute = mock((options: any) => {
      expect(options.args).toEqual(["emp-1", "mgr-1"]);
      return Promise.resolve({
        rows: [{ 1: 1 }],
      });
    }) as any;

    const result = await checkUplineManager("mgr-1", "emp-1");
    expect(result).toBe(true);
  });

  it("should fall back to local database query if fetch fails and return false if manager not found", async () => {
    global.fetch = mock(() => {
      return Promise.reject(new Error("Network failure"));
    }) as any;

    db.execute = mock(() => {
      return Promise.resolve({
        rows: [],
      });
    }) as any;

    const result = await checkUplineManager("mgr-1", "emp-1");
    expect(result).toBe(false);
  });
});
