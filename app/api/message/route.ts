import prisma from '@/lib/prisma';
import { MAX_MESSAGES, MESSAGE_LAYOUT_LOCK_ID } from '@/lib/config';
import { defaultSize, findFreeSpot, GEOMETRY_MESSAGES, overlapsAny } from '@/lib/geometry';
import type { Geometry } from '@/lib/geometry';
import { getMessages } from '@/utils/messages';
import type { Message } from '@/utils/messages';
import { validateMessage } from '@/lib/validation';
import { checkRateLimit, deleteExpiredRateLimits } from '@/lib/rateLimit';
import { isSameOrigin } from '@/lib/request';
import { createEditToken } from '@/lib/editToken';
import { after } from 'next/server';

// A valid message is well under 1 KB, so anything larger is not a real submission.
const MAX_BODY_BYTES = 2048;

const TOO_MANY_MESSAGE = 'Too many messages from your network. Please try again later.';

// Share of accepted requests that also clear out expired rate limit rows.
const CLEANUP_SAMPLE_RATE = 0.05;

class CardFullError extends Error {}

class SpotTakenError extends Error {
  constructor(readonly messages: Message[]) {
    super('spot_taken');
  }
}

function errorResponse(
  status: number,
  error: string,
  message: string,
  headers?: Record<string, string>,
) {
  return Response.json({ error, message }, { status, headers });
}

function messageResponse(
  message: { id: number; text: string; fontFamily: string; createdAt: Date },
  box: Geometry | null,
  status: number,
  editToken: string,
) {
  return Response.json(
    {
      message: {
        id: message.id,
        text: message.text,
        fontFamily: message.fontFamily,
        createdAt: message.createdAt.toISOString(),
        box,
      },
      editToken,
    },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

async function boxOf(id: number, db?: Parameters<typeof getMessages>[0]): Promise<Geometry | null> {
  const messages = await getMessages(db);
  return messages.find((message) => message.id === id)?.box ?? null;
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
// The name is not one browsers autofill (like "website" or "url"), so real visitors never fill it.
const HONEYPOT_FIELD = 'hp_extra';

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
  const { text, fontFamily, requestId, geometry } = validation.data;

  // Someone else may have taken the chosen spot since the signer opened the page. The reply carries
  // the card as it is now, so the signer can pick another spot without retyping anything.
  const spotTaken = async (messages: Message[]) => {
    const rateLimit = await checkRateLimit(request, 'invalid');
    if (rateLimit.unavailable) return unavailableResponse(rateLimit.retryAfterSeconds);
    if (rateLimit.limited) return limitedResponse(rateLimit.retryAfterSeconds, TOO_MANY_MESSAGE);
    return Response.json(
      { error: 'spot_taken', message: GEOMETRY_MESSAGES.overlap, messages },
      { status: 409, headers: { 'Cache-Control': 'no-store' } },
    );
  };

  // A retry of a submit that already went through gets the saved message back,
  // without using any of the rate limit allowance. Only the hash of the edit token
  // is stored, so a retry gets a fresh token (the requestId is the creator's secret
  // and is never returned by any other endpoint).
  if (requestId) {
    try {
      const existing = await prisma.message.findUnique({ where: { requestId } });
      if (existing) {
        const { token, hash } = createEditToken();
        await prisma.message.update({ where: { id: existing.id }, data: { editTokenHash: hash } });
        return messageResponse(existing, await boxOf(existing.id), 200, token);
      }
    } catch (error) {
      console.error('Error checking request id:', error);
      return errorResponse(500, 'server_error', 'Failed to save message.');
    }
  }

  // Checked before the sign allowance is used, so picking a taken spot never costs a try.
  if (geometry) {
    try {
      const current = await getMessages();
      if (overlapsAny(geometry, current.map((message) => message.box))) return spotTaken(current);
    } catch (error) {
      console.error('Error checking the spot:', error);
      return errorResponse(500, 'server_error', 'Failed to save message.');
    }
  }

  const rateLimit = await checkRateLimit(request);
  if (rateLimit.unavailable) return unavailableResponse(rateLimit.retryAfterSeconds);
  if (rateLimit.limited) {
    return limitedResponse(rateLimit.retryAfterSeconds, TOO_MANY_MESSAGE);
  }
  if (Math.random() < CLEANUP_SAMPLE_RATE) after(deleteExpiredRateLimits);

  const { token, hash } = createEditToken();

  try {
    const saved = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MESSAGE_LAYOUT_LOCK_ID})`;

      // Another request with the same id may have won while this one waited for the lock.
      if (requestId) {
        const existing = await tx.message.findUnique({ where: { requestId } });
        if (existing) {
          await tx.message.update({ where: { id: existing.id }, data: { editTokenHash: hash } });
          return { message: existing, box: await boxOf(existing.id, tx), created: false };
        }
      }

      const current = await getMessages(tx);
      if (current.length >= MAX_MESSAGES) throw new CardFullError();
      const taken = current.map((message) => message.box);

      let box = geometry;
      if (box) {
        if (overlapsAny(box, taken)) throw new SpotTakenError(current);
      } else {
        // A client that sent no spot (an old tab, or a script) gets a free one.
        box = findFreeSpot(taken, defaultSize(text.length), undefined, text);
        if (!box) throw new CardFullError();
      }

      const created = await tx.message.create({
        data: {
          text,
          fontFamily,
          requestId,
          editTokenHash: hash,
          placeX: box.x,
          placeY: box.y,
          placeWidth: box.width,
          placeHeight: box.height,
          placeRotation: box.rotation,
        },
      });
      return { message: created, box, created: true };
    });

    return messageResponse(saved.message, saved.box, saved.created ? 201 : 200, token);
  } catch (error) {
    if (error instanceof SpotTakenError) return spotTaken(error.messages);
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
