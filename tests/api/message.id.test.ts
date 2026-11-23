import { describe, expect, it, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { createEditToken } from '@/lib/editToken';
import { getMessages } from '@/utils/messages';
import { adminDelete, deleteMessage, freeSpot, insertLegacyMessage, patchMessage, signCard } from './helpers';

const NOT_FOUND = { error: 'not_found', message: 'This message cannot be changed.' };

describe('PATCH /api/message/<id>', () => {
  it('changes the text, font and place with the right token', async () => {
    const mine = await signCard();
    const geometry = await freeSpot('Updated', [mine.box]);
    const response = await patchMessage(mine.id, { text: 'Updated', fontFamily: 'Great Vibes', geometry }, mine.token);
    expect(response.status).toBe(200);
    expect((await response.json()).message).toMatchObject({ id: mine.id, text: 'Updated', fontFamily: 'Great Vibes', box: geometry });

    const row = await prisma.message.findUniqueOrThrow({ where: { id: mine.id } });
    expect(row).toMatchObject({ text: 'Updated', fontFamily: 'Great Vibes', placeX: geometry.x, placeY: geometry.y });
  });

  it('keeps the place when no geometry is sent', async () => {
    const mine = await signCard();
    const response = await patchMessage(mine.id, { text: 'Same place', fontFamily: 'Allura' }, mine.token);
    expect(response.status).toBe(200);
    expect((await response.json()).message.box).toEqual(mine.box);
  });

  it('answers the same way for a wrong token, an unknown id and a legacy message', async () => {
    const mine = await signCard();
    const legacy = await insertLegacyMessage();
    const update = { text: 'Hacked', fontFamily: 'Allura' };
    const anyToken = createEditToken().token;

    for (const [id, token] of [
      [mine.id, anyToken],
      [999, mine.token],
      [legacy.id, anyToken],
      ['abc', mine.token],
    ] as const) {
      const response = await patchMessage(id, update, token);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual(NOT_FOUND);
    }
    expect((await prisma.message.findUniqueOrThrow({ where: { id: mine.id } })).text).not.toBe('Hacked');
  });

  it('changes nothing when the token is replaced while the request is under way', async () => {
    const mine = await signCard();

    // A retry of the original submit replaces the token after this request was authorised,
    // but before it writes. Only the stored hash in the update condition can catch that.
    const transaction = prisma.$transaction.bind(prisma);
    const spy = vi.spyOn(prisma, '$transaction').mockImplementationOnce((async (...args: unknown[]) => {
      await prisma.message.update({ where: { id: mine.id }, data: { editTokenHash: createEditToken().hash } });
      return (transaction as (...a: unknown[]) => unknown)(...args);
    }) as typeof prisma.$transaction);

    try {
      const response = await patchMessage(mine.id, { text: 'Too late', fontFamily: 'Allura' }, mine.token);
      expect(response.status).toBe(404);
      expect((await prisma.message.findUniqueOrThrow({ where: { id: mine.id } })).text).not.toBe('Too late');
    } finally {
      spy.mockRestore();
    }
  });

  it('refuses a move onto another message', async () => {
    const other = await signCard('Someone else');
    const mine = await signCard('Mine', { ip: '198.51.100.2' });
    const response = await patchMessage(mine.id, { text: 'Mine', fontFamily: 'Allura', geometry: other.box }, mine.token);
    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error).toBe('spot_taken');
    expect(json.messages.map((message: { id: number }) => message.id)).toEqual([other.id]);
  });
});

describe('DELETE /api/message/<id>', () => {
  it('removes the message once with the right token', async () => {
    const mine = await signCard();
    expect((await deleteMessage(mine.id, createEditToken().token)).status).toBe(404);

    const response = await deleteMessage(mine.id, mine.token);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: mine.id });
    expect(await prisma.message.count()).toBe(0);

    expect((await deleteMessage(mine.id, mine.token)).status).toBe(404);
  });

  it('refuses requests from another site', async () => {
    const mine = await signCard();
    expect((await deleteMessage(mine.id, mine.token, { origin: 'http://evil.test' })).status).toBe(403);
    expect(await prisma.message.count()).toBe(1);
  });
});

describe('legacy messages', () => {
  it('stay where they are when the layout changes', async () => {
    const legacy = [await insertLegacyMessage('Old 1'), await insertLegacyMessage('Old 2'), await insertLegacyMessage('Old 3')];
    const boxesBefore = new Map((await getMessages()).map((message) => [message.id, message.box]));
    const mine = await signCard();

    // Removing a new message pins the computed places of the legacy ones into the database.
    expect((await deleteMessage(mine.id, mine.token)).status).toBe(200);
    for (const row of await prisma.message.findMany({ where: { id: { in: legacy.map((m) => m.id) } } })) {
      expect({
        x: row.placeX,
        y: row.placeY,
        width: row.placeWidth,
        height: row.placeHeight,
        rotation: row.placeRotation,
      }).toEqual(boxesBefore.get(row.id));
    }

    // Removing a legacy message does not move the others.
    expect((await adminDelete(legacy[0].id, 'test-admin-token')).status).toBe(200);
    for (const message of await getMessages()) {
      expect(message.box).toEqual(boxesBefore.get(message.id));
    }
  });
});
