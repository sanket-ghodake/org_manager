import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { PORTAL_INTERNAL_URL } from "../../backend/config";
import {
  clearWorkingPortalUrlCache,
  getWorkingPortalUrl,
} from "../../backend/utils/portal";

describe("portal utility unit tests", () => {
  let originalFetch: any;

  beforeEach(() => {
    originalFetch = global.fetch;
    clearWorkingPortalUrlCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    clearWorkingPortalUrlCache();
  });

  it("should return the first reachable candidate base URL", async () => {
    // Mock fetch to succeed for host.docker.internal candidate
    global.fetch = mock((url: string) => {
      if (url.includes("host.docker.internal")) {
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve({ users: [] }),
        });
      }
      return Promise.reject(new Error("Unreachable"));
    }) as any;

    const url = await getWorkingPortalUrl();
    expect(url).toBe("http://host.docker.internal:3001");
  });

  it("should fall back to PORTAL_INTERNAL_URL when all candidates are unreachable", async () => {
    global.fetch = mock(() => {
      return Promise.reject(new Error("Unreachable"));
    }) as any;

    const url = await getWorkingPortalUrl();
    expect(url).toBe(PORTAL_INTERNAL_URL);
  });

  it("should cache and return the cached URL without calling fetch again", async () => {
    let callCount = 0;
    global.fetch = mock((url: string) => {
      callCount++;
      if (url.includes("localhost")) {
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve({ users: [] }),
        });
      }
      return Promise.reject(new Error("Unreachable"));
    }) as any;

    const url1 = await getWorkingPortalUrl();
    expect(url1).toBe("http://localhost:3001");
    expect(callCount).toBeGreaterThan(0);

    const prevCallCount = callCount;
    // Call again, should hit cache
    const url2 = await getWorkingPortalUrl();
    expect(url2).toBe("http://localhost:3001");
    expect(callCount).toBe(prevCallCount);
  });
});
