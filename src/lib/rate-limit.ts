interface RateLimitRecord {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

const globalStore = globalThis as typeof globalThis & {
  __finarcRateLimitStore?: Map<string, RateLimitRecord>;
};

const store = globalStore.__finarcRateLimitStore ?? new Map<string, RateLimitRecord>();
globalStore.__finarcRateLimitStore = store;

export function getClientIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

export function checkRateLimit(key: string, options: RateLimitOptions) {
  const now = Date.now();
  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return { ok: true, remaining: options.limit - 1, resetAt: now + options.windowMs };
  }

  if (current.count >= options.limit) {
    return { ok: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  return { ok: true, remaining: options.limit - current.count, resetAt: current.resetAt };
}
