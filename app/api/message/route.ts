import prisma from '@/lib/prisma';
import { MAX_MESSAGES } from '@/lib/config';
import { validateMessage } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rateLimit';

// Arbitrary constant key for a Postgres advisory lock that serialises message
// creation, so concurrent requests cannot push the card past MAX_MESSAGES.
const CREATE_MESSAGE_LOCK_ID = 4242001;

// A valid message is well under 1 KB, so anything larger is not a real submission.
const MAX_BODY_BYTES = 2048;

class CardFullError extends Error {}

function errorResponse(
  status: number,
  error: string,
  message: string,
  headers?: Record<string, string>,
) {
  return Response.json({ error, message }, { status, headers });
}

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request);
  if (rateLimit.limited) {
    return errorResponse(
      429,
      'rate_limited',
      'Too many messages from your network. Please try again later.',
      { 'Retry-After': String(rateLimit.retryAfterSeconds) },
    );
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return errorResponse(413, 'payload_too_large', 'Request body is too large.');
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
    return errorResponse(413, 'payload_too_large', 'Request body is too large.');
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
  }

  const validation = validateMessage(body);
  if (!validation.ok) {
    return errorResponse(400, 'invalid_message', validation.message);
  }
  const { text, fontFamily } = validation.data;

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
