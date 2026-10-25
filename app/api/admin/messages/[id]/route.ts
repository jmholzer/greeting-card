import { createHash, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rateLimit';
import { MESSAGE_LAYOUT_LOCK_ID } from '@/lib/config';
import { pinLegacyBoxes } from '@/utils/messages';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

function hash(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function hasValidToken(request: Request, token: string): boolean {
  const match = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '');
  return match !== null && timingSafeEqual(hash(match[1]), hash(token));
}

/**
 * Deletes one message: `DELETE /api/admin/messages/<id>` with
 * `Authorization: Bearer <ADMIN_TOKEN>`. Disabled (404) unless ADMIN_TOKEN is set.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return new Response('Not found', { status: 404, headers: NO_STORE });

  if (!hasValidToken(request, token)) {
    const rateLimit = await checkRateLimit(request, 'admin');
    if (rateLimit.limited) {
      return Response.json(
        { error: 'rate_limited' },
        { status: 429, headers: { ...NO_STORE, 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  }

  const { id: rawId } = await params;
  if (!/^\d{1,9}$/.test(rawId)) {
    return Response.json({ error: 'invalid_id' }, { status: 400, headers: NO_STORE });
  }
  const id = Number(rawId);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MESSAGE_LAYOUT_LOCK_ID})`;
      await pinLegacyBoxes(tx);
      await tx.message.delete({ where: { id } });
    });
    return Response.json({ deleted: id }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return Response.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
    }
    console.error('Error deleting message:', error);
    return Response.json({ error: 'server_error' }, { status: 500, headers: NO_STORE });
  }
}
