import { PORTAL_INTERNAL_URL } from '../config';

let cachedWorkingUrl: string | null = null;
let lastCheckedTime = 0;
const CHECK_INTERVAL = 30000; // 30 seconds TTL
let activeResolvePromise: Promise<string> | null = null;

const candidates = [
  PORTAL_INTERNAL_URL,
  `http://host.docker.internal:3001`,
  `http://172.21.0.1:3001`,
  `http://172.17.0.1:3001`,
  `http://localhost:3001`,
];

/**
 * Resolves the working base URL for the Portal.
 * Candidate URLs are pinged in parallel to quickly identify the one that is reachable.
 * Once found, the working URL is cached to eliminate latency on subsequent requests.
 */
export async function getWorkingPortalUrl(): Promise<string> {
  const now = Date.now();
  if (cachedWorkingUrl && (now - lastCheckedTime < CHECK_INTERVAL)) {
    return cachedWorkingUrl;
  }

  if (activeResolvePromise) {
    return activeResolvePromise;
  }

  activeResolvePromise = (async () => {
    // Strip trailing slashes if any
    const urlsToTry = candidates.map(url => url.replace(/\/+$/, ''));

    const results = await Promise.allSettled(
      urlsToTry.map(async (baseUrl) => {
        const url = `${baseUrl}/api/directory?rootsOnly=true`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600);
        try {
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          // Any HTTP response (even authorization failure) indicates the host is reachable
          if (res.status >= 200 && res.status < 500) {
            return baseUrl;
          }
        } catch (e) {
          clearTimeout(timeoutId);
        }
        throw new Error('Unreachable');
      })
    );

    for (const res of results) {
      if (res.status === 'fulfilled') {
        cachedWorkingUrl = res.value;
        lastCheckedTime = Date.now();
        console.log(`Resolved and cached working portal URL: ${cachedWorkingUrl}`);
        activeResolvePromise = null;
        return cachedWorkingUrl;
      }
    }

    // If all are unreachable, cache the fallback to avoid checking again immediately
    cachedWorkingUrl = PORTAL_INTERNAL_URL;
    lastCheckedTime = Date.now();
    console.log(`All candidates unreachable. Caching fallback PORTAL_INTERNAL_URL: ${cachedWorkingUrl} for 30s`);
    activeResolvePromise = null;
    return PORTAL_INTERNAL_URL;
  })();

  return activeResolvePromise;
}

export function clearWorkingPortalUrlCache() {
  cachedWorkingUrl = null;
  lastCheckedTime = 0;
  activeResolvePromise = null;
}
