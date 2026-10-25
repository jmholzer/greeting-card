import { createHash } from 'crypto';
import prisma from '@/lib/prisma';
import {
  RATE_LIMIT_ADMIN_MAX,
  RATE_LIMIT_INVALID_MAX,
  RATE_LIMIT_MAX,
  RATE_LIMIT_UNKNOWN_FACTOR,
  RATE_LIMIT_WINDOW_SECONDS,
} from '@/lib/config';

export type RateLimitBucket = 'message' | 'invalid' | 'admin';

export interface RateLimitResult {
  limited: boolean;
  retryAfterSeconds: number;
  /** The limiter itself failed, so the caller should refuse the request. */
  unavailable?: boolean;
}

const LIMITS: Record<RateLimitBucket, number> = {
  message: RATE_LIMIT_MAX,
  invalid: RATE_LIMIT_INVALID_MAX,
  admin: RATE_LIMIT_ADMIN_MAX,
};

function firstValue(value: string | null): string | null {
  return value?.split(',')[0]?.trim() || null;
}

// Vercel sets these headers itself and replaces any value sent by the client.
// Everywhere else the headers are client-controlled, so they are ignored.
export function getClientIp(headers: Headers): string | null {
  if (!process.env.VERCEL) return null;
  return firstValue(headers.get('x-vercel-forwarded-for')) ?? firstValue(headers.get('x-real-ip'));
}

// Fixed-window counter kept in Postgres, which is already required by the app.
// In-memory counters don't work on serverless because each instance has its own.
// The upsert is a single atomic statement, so concurrent requests are counted
// correctly. Only a hash of the client IP is stored.
export async function checkRateLimit(
  request: Request,
  bucket: RateLimitBucket = 'message',
): Promise<RateLimitResult> {
  const ip = getClientIp(request.headers);
  let limit = LIMITS[bucket];

  if (!ip) {
    // Local development has no trustworthy address, so there is nothing to key on.
    if (process.env.NODE_ENV !== 'production') return { limited: false, retryAfterSeconds: 0 };
    limit *= RATE_LIMIT_UNKNOWN_FACTOR;
  }

  const key = createHash('sha256').update(`${bucket}:${ip ?? 'unknown'}`).digest('hex');

  try {
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
      limited: count > limit,
      retryAfterSeconds: Math.max(retryAfter, 1),
    };
  } catch (error) {
    // Saving a message needs the same database, so refuse rather than skip the limit.
    console.error('Rate limit check failed:', error);
    return { limited: false, retryAfterSeconds: 30, unavailable: true };
  }
}

// Called after a response has been sent, so it never slows a request down.
export async function deleteExpiredRateLimits(): Promise<void> {
  try {
    await prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "windowStart" < now() - interval '1 hour'`;
  } catch (error) {
    console.error('Rate limit cleanup failed:', error);
  }
}
