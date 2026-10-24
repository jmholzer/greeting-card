import { createHash } from 'crypto';
import prisma from '@/lib/prisma';
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SECONDS } from '@/lib/config';

export interface RateLimitResult {
  limited: boolean;
  retryAfterSeconds: number;
}

// On Vercel the platform sets these headers itself, so clients cannot spoof them.
export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || null;
}

// Fixed-window counter kept in Postgres, which is already required by the app.
// In-memory counters don't work on serverless because each instance has its own.
// The upsert is a single atomic statement, so concurrent requests are counted
// correctly. Only a hash of the client IP is stored.
export async function checkRateLimit(request: Request): Promise<RateLimitResult> {
  const ip = getClientIp(request);
  if (!ip) {
    // No client address available (e.g. local development): nothing to key on.
    return { limited: false, retryAfterSeconds: 0 };
  }

  const key = createHash('sha256').update(ip).digest('hex');

  try {
    await prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "windowStart" < now() - interval '1 hour'`;

    const rows = await prisma.$queryRaw<{ count: number; retryAfter: number }[]>`
      INSERT INTO "RateLimit" ("key", "count", "windowStart")
      VALUES (${key}, 1, now())
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${RATE_LIMIT_WINDOW_SECONDS})
          THEN 1 ELSE "RateLimit"."count" + 1 END,
        "windowStart" = CASE
          WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${RATE_LIMIT_WINDOW_SECONDS})
          THEN now() ELSE "RateLimit"."windowStart" END
      RETURNING
        "count",
        CEIL(EXTRACT(EPOCH FROM ("RateLimit"."windowStart" + make_interval(secs => ${RATE_LIMIT_WINDOW_SECONDS}) - now())))::int AS "retryAfter"
    `;

    const { count, retryAfter } = rows[0];
    return {
      limited: count > RATE_LIMIT_MAX,
      retryAfterSeconds: Math.max(retryAfter, 1),
    };
  } catch (error) {
    // Fail open: a broken limiter should not stop people signing the card.
    console.error('Rate limit check failed:', error);
    return { limited: false, retryAfterSeconds: 0 };
  }
}
