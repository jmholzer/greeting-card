import prisma from '@/lib/prisma';
import { MAX_MESSAGES } from '@/lib/config';
import { validateMessage } from '@/lib/validation';
import { checkRateLimit, deleteExpiredRateLimits } from '@/lib/rateLimit';
import { isSameOrigin } from '@/lib/request';
import { after } from 'next/server';

// Arbitrary constant key for a Postgres advisory lock that serialises message
// creation, so concurrent requests cannot push the card past MAX_MESSAGES.
const CREATE_MESSAGE_LOCK_ID = 4242001;

// A valid message is well under 1 KB, so anything larger is not a real submission.
const MAX_BODY_BYTES = 2048;

const TOO_MANY_MESSAGE = 'Too many messages from your network. Please try again later.';

// Share of accepted requests that also clear out expired rate limit rows.
const CLEANUP_SAMPLE_RATE = 0.05;

class CardFullError extends Error {}

function errorResponse(
  status: number,
  error: string,
  message: string,
  headers?: Record<string, string>,
) {
  return Response.json({ error, message }, { status, headers });
}

function unavailableResponse(retryAfterSeconds: number) {
  return errorResponse(503, 'unavailable', 'Please try again in a moment.', {
    'Retry-After': String(retryAfterSeconds),
  });
}

function limitedResponse(retryAfterSeconds: number, message: string) {
  return errorResponse(429, 'rate_limited', message, { 'Retry-After': String(retryAfterSeconds) });
}

// Spam bots tend to fill in every field, so a visitor never sees or fills this one.
const HONEYPOT_FIELD = 'website';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return errorResponse(403, 'forbidden_origin', 'Requests must come from this site.');
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return errorResponse(415, 'unsupported_media_type', 'Content-Type must be application/json.');
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return errorResponse(413, 'payload_too_large', 'Request body is too large.');
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
    return errorResponse(413, 'payload_too_large', 'Request body is too large.');
  }

  // Malformed requests are counted separately, so typos never use up a visitor's real allowance.
  const rejectInvalid = async (status: number, error: string, message: string) => {
    const rateLimit = await checkRateLimit(request, 'invalid');
    if (rateLimit.unavailable) return unavailableResponse(rateLimit.retryAfterSeconds);
    if (rateLimit.limited) {
      return limitedResponse(rateLimit.retryAfterSeconds, TOO_MANY_MESSAGE);
    }
    return errorResponse(status, error, message);
  };

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return rejectInvalid(400, 'invalid_json', 'Request body must be valid JSON.');
  }

  if (typeof body === 'object' && body !== null) {
    const trap = (body as Record<string, unknown>)[HONEYPOT_FIELD];
    if (typeof trap === 'string' && trap.trim() !== '') {
      // Looks like a success so the bot moves on, but nothing is saved.
      const rateLimit = await checkRateLimit(request, 'invalid');
      if (rateLimit.limited) return limitedResponse(rateLimit.retryAfterSeconds, TOO_MANY_MESSAGE);
      return Response.json({ message: null });
    }
  }

  const validation = validateMessage(body);
  if (!validation.ok) {
    return rejectInvalid(400, 'invalid_message', validation.message);
  }
  const { text, fontFamily } = validation.data;

  const rateLimit = await checkRateLimit(request);
  if (rateLimit.unavailable) return unavailableResponse(rateLimit.retryAfterSeconds);
  if (rateLimit.limited) {
    return limitedResponse(rateLimit.retryAfterSeconds, TOO_MANY_MESSAGE);
  }
  if (Math.random() < CLEANUP_SAMPLE_RATE) after(deleteExpiredRateLimits);

  try {
    const message = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CREATE_MESSAGE_LOCK_ID})`;

      const count = await tx.message.count();
      if (count >= MAX_MESSAGES) {
        throw new CardFullError();
      }

      return tx.message.create({ data: { text, fontFamily } });
    });

    return Response.json(
      {
        message: {
          id: message.id,
          text: message.text,
          fontFamily: message.fontFamily,
          createdAt: message.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof CardFullError) {
      return errorResponse(
        409,
        'card_full',
        'The card is full and cannot accept any more messages.',
      );
    }
    console.error('Error saving message:', error);
    return errorResponse(500, 'server_error', 'Failed to save message.');
  }
}
