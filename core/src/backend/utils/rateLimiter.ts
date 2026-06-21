interface RateLimitData {
  count: number;
  resetTime: number;
}

// Memory-efficient in-memory map structure: namespace -> IP -> data
const stores = new Map<string, Map<string, RateLimitData>>();

/**
 * Checks if a given IP address has exceeded the rate limit threshold for a specific namespace.
 * 
 * @param ip Client IP address
 * @param namespace Name of the endpoint/feature (e.g. 'login', 'reset-password')
 * @param limit Maximum number of allowed requests in the time window
 * @param windowMs Time window in milliseconds
 * @returns Object indicating if request is rate limited and current status
 */
export function isRateLimited(
  ip: string,
  namespace: string,
  limit: number = 5,
  windowMs: number = 60000
): { limited: boolean; current: number; limit: number; resetTime: number } {
  let store = stores.get(namespace);
  if (!store) {
    store = new Map<string, RateLimitData>();
    stores.set(namespace, store);
  }

  const now = Date.now();

  // Active pruning of expired keys to prevent memory leaks
  if (store.size > 1000) {
    for (const [key, val] of store.entries()) {
      if (now >= val.resetTime) {
        store.delete(key);
      }
    }
    // Hard cap defense: clear if still exceeding maximum size under active attack
    if (store.size > 2000) {
      store.clear();
    }
  }
  let data = store.get(ip);

  if (!data || now >= data.resetTime) {
    data = { count: 1, resetTime: now + windowMs };
    store.set(ip, data);
    return { limited: false, current: 1, limit, resetTime: data.resetTime };
  }

  if (data.count >= limit) {
    return { limited: true, current: data.count, limit, resetTime: data.resetTime };
  }

  data.count++;
  return { limited: false, current: data.count, limit, resetTime: data.resetTime };
}
