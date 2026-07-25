/**
 * Rate limiting per INFRA.md §2. Usa Upstash Redis si está configurado
 * (UPSTASH_REDIS_REST_URL/TOKEN); si no, cae a un limitador en memoria
 * por instancia — documentado como no apto para escalado horizontal.
 */

type RateLimitResult = { success: boolean; remaining: number; limit: number };

const WINDOW_MS = 60_000;
const memoryStore = new Map<string, { count: number; resetAt: number }>();

function checkInMemory(key: string, limit: number): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { success: true, remaining: limit - 1, limit };
  }

  entry.count += 1;
  const success = entry.count <= limit;
  return { success, remaining: Math.max(0, limit - entry.count), limit };
}

async function checkUpstash(
  key: string,
  limit: number,
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;

  const incrRes = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { result: count } = (await incrRes.json()) as { result: number };

  if (count === 1) {
    await fetch(
      `${url}/expire/${encodeURIComponent(key)}/${Math.floor(WINDOW_MS / 1000)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  }

  return { success: count <= limit, remaining: Math.max(0, limit - count), limit };
}

/** Aplica un límite de `limit` requests por minuto para `identifier` (IP o userId). */
export async function checkRateLimit(
  identifier: string,
  limit: number,
): Promise<RateLimitResult> {
  const key = `ratelimit:${identifier}`;
  const useUpstash =
    !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

  return useUpstash ? checkUpstash(key, limit) : checkInMemory(key, limit);
}
