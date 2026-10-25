import prisma from '@/lib/prisma';
import { validateMessage } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rateLimit';
import { isSameOrigin } from '@/lib/request';
import { editTokenMatches, getBearerToken, hashEditToken } from '@/lib/editToken';
import { MESSAGE_LAYOUT_LOCK_ID } from '@/lib/config';
import { GEOMETRY_MESSAGES, overlapsAny } from '@/lib/geometry';
import { getMessages, pinLegacyBoxes } from '@/utils/messages';
import type { Message } from '@/utils/messages';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 2048;

const NO_STORE = { 'Cache-Control': 'no-store' };

const TOO_MANY = 'Too many requests from your network. Please try again later.';

// Same field as on POST. A person editing their own message never fills it in.
const HONEYPOT_FIELD = 'hp_extra';

function errorResponse(
  status: number,
  error: string,
  message: string,
  headers?: Record<string, string>,
) {
  return Response.json({ error, message }, { status, headers: { ...NO_STORE, ...headers } });
}

// An unknown id, a message that cannot be edited and a wrong token all look the same,
// so the response never reveals which ids exist.
const notFound = () => errorResponse(404, 'not_found', 'This message cannot be changed.');

async function limitResponse(request: Request, bucket: 'invalid' | 'edit') {
  const rateLimit = await checkRateLimit(request, bucket);
  if (rateLimit.unavailable) {
    return errorResponse(503, 'unavailable', 'Please try again in a moment.', {
      'Retry-After': String(rateLimit.retryAfterSeconds),
    });
  }
  if (rateLimit.limited) {
    return errorResponse(429, 'rate_limited', TOO_MANY, {
      'Retry-After': String(rateLimit.retryAfterSeconds),
    });
  }
  return null;
}

async function rejectInvalid(request: Request, status: number, error: string, message: string) {
  return (await limitResponse(request, 'invalid')) ?? errorResponse(status, error, message);
}

/**
 * Checks the id and the bearer token. Returns the numeric id, or a response to send back.
 * Failed attempts count against the same allowance as malformed requests.
 */
async function authorize(
  request: Request,
  rawId: string,
): Promise<{ id: number; token: string } | Response> {
  const token = getBearerToken(request);
  const id = /^\d{1,9}$/.test(rawId) ? Number(rawId) : null;

  let storedHash: string | null = null;
  if (id !== null) {
    try {
      const row = await prisma.message.findUnique({ where: { id }, select: { editTokenHash: true } });
      storedHash = row?.editTokenHash ?? null;
    } catch (error) {
      console.error('Error looking up message:', error);
      return errorResponse(500, 'server_error', 'Something went wrong. Please try again.');
    }
  }

  if (id === null || token === null || !editTokenMatches(storedHash, token)) {
    return (await limitResponse(request, 'invalid')) ?? notFound();
  }
  return { id, token };
}

class SpotTakenError extends Error {
  constructor(readonly others: Message[]) {
    super('spot_taken');
  }
}

/** Changes the text, font and place of a message: `PATCH /api/message/<id>` with `Authorization: Bearer <edit token>`. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) {
    return errorResponse(403, 'forbidden_origin', 'Requests must come from this site.');
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return errorResponse(415, 'unsupported_media_type', 'Content-Type must be application/json.');
  }
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return errorResponse(413, 'payload_too_large', 'Request body is too large.');
  }
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
    return errorResponse(413, 'payload_too_large', 'Request body is too large.');
  }

  const { id: rawId } = await params;
  const auth = await authorize(request, rawId);
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return rejectInvalid(request, 400, 'invalid_json', 'Request body must be valid JSON.');
  }

  if (typeof body === 'object' && body !== null) {
    const trap = (body as Record<string, unknown>)[HONEYPOT_FIELD];
    if (typeof trap === 'string' && trap.trim() !== '') {
      return rejectInvalid(request, 400, 'invalid_message', 'Request was not accepted.');
    }
  }

  const validation = validateMessage(body);
  if (!validation.ok) {
    return rejectInvalid(request, 400, 'invalid_message', validation.message);
  }
  const { text, fontFamily, geometry } = validation.data;

  const limited = await limitResponse(request, 'edit');
  if (limited) return limited;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (geometry) {
        // Changes to the layout run one at a time, so two messages can never end up on the same spot.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MESSAGE_LAYOUT_LOCK_ID})`;
        await pinLegacyBoxes(tx);
        const others = (await getMessages(tx)).filter((message) => message.id !== auth.id);
        if (overlapsAny(geometry, others.map((message) => message.box))) {
          throw new SpotTakenError(others);
        }
      }

      // The hash is part of the condition, so a token that was replaced in the meantime changes nothing.
      const result = await tx.message.updateMany({
        where: { id: auth.id, editTokenHash: hashEditToken(auth.token) },
        data: {
          text,
          fontFamily,
          ...(geometry && {
            placeX: geometry.x,
            placeY: geometry.y,
            placeWidth: geometry.width,
            placeHeight: geometry.height,
            placeRotation: geometry.rotation,
          }),
        },
      });
      if (result.count === 0) return null;
      return (await getMessages(tx)).find((message) => message.id === auth.id) ?? null;
    });
    if (!updated) return notFound();
    return Response.json(
      {
        message: {
          id: updated.id,
          text: updated.text,
          fontFamily: updated.fontFamily,
          createdAt: updated.createdAt,
          box: updated.box,
        },
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof SpotTakenError) {
      return Response.json(
        { error: 'spot_taken', message: GEOMETRY_MESSAGES.overlap, messages: error.others },
        { status: 409, headers: NO_STORE },
      );
    }
    console.error('Error updating message:', error);
    return errorResponse(500, 'server_error', 'Failed to save message.');
  }
}

/** Removes a message and frees its place on the card: `DELETE /api/message/<id>` with `Authorization: Bearer <edit token>`. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) {
    return errorResponse(403, 'forbidden_origin', 'Requests must come from this site.');
  }

  const { id: rawId } = await params;
  const auth = await authorize(request, rawId);
  if (auth instanceof Response) return auth;

  const limited = await limitResponse(request, 'edit');
  if (limited) return limited;

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MESSAGE_LAYOUT_LOCK_ID})`;
      await pinLegacyBoxes(tx);
      return tx.message.deleteMany({
        where: { id: auth.id, editTokenHash: hashEditToken(auth.token) },
      });
    });
    if (result.count === 0) return notFound();
    return Response.json({ deleted: auth.id }, { headers: NO_STORE });
  } catch (error) {
    console.error('Error deleting message:', error);
    return errorResponse(500, 'server_error', 'Failed to delete message.');
  }
}
