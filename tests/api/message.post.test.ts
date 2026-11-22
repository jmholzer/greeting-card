import { describe, expect, it, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { checkGeometry } from '@/lib/geometry';
import { hashEditToken } from '@/lib/editToken';
import { MAX_MESSAGES, RATE_LIMIT_MAX } from '@/lib/config';
import { freeSpot, patchMessage, postMessage, signCard, validMessage } from './helpers';

describe('POST /api/message', () => {
  it('saves a message in the chosen spot and returns an edit token', async () => {
    const body = await validMessage();
    const response = await postMessage(body);
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');

    const json = await response.json();
    expect(json.message).toMatchObject({ text: body.text, fontFamily: body.fontFamily, box: body.geometry });
    expect(json.editToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const row = await prisma.message.findUniqueOrThrow({ where: { id: json.message.id } });
    expect(row.editTokenHash).toBe(hashEditToken(json.editToken));
    expect(Object.values(row)).not.toContain(json.editToken);
    expect(row).toMatchObject({
      placeX: body.geometry.x,
      placeY: body.geometry.y,
      placeWidth: body.geometry.width,
      placeHeight: body.geometry.height,
      placeRotation: body.geometry.rotation,
    });
  });

  it('picks a valid spot when the client sends none', async () => {
    const first = await signCard();
    const response = await postMessage({ text: 'No spot given', fontFamily: 'Allura' });
    expect(response.status).toBe(201);
    const { message } = await response.json();
    expect(checkGeometry(message.box, [first.box], 'No spot given')).toBeNull();
  });

  it('refuses a taken spot without using the sign allowance', async () => {
    const first = await signCard();
    const response = await postMessage(
      { text: 'Same place', fontFamily: 'Allura', geometry: first.box },
      { ip: '198.51.100.7' },
    );
    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error).toBe('spot_taken');
    expect(json.messages.map((message: { id: number }) => message.id)).toEqual([first.id]);

    // The refused attempt did not count, so the full allowance is still there.
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      expect((await postMessage(await validMessage(`Note ${i}`), { ip: '198.51.100.7' })).status).toBe(201);
    }
  });

  it('treats a retry with the same request id as the same message', async () => {
    const body = await validMessage();
    const first = await postMessage(body);
    const second = await postMessage(body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);

    const firstJson = await first.json();
    const secondJson = await second.json();
    expect(secondJson.message.id).toBe(firstJson.message.id);
    expect(secondJson.editToken).not.toBe(firstJson.editToken);
    expect(await prisma.message.count()).toBe(1);

    // Only the newest token can change the message.
    const update = { text: 'Changed', fontFamily: 'Allura' };
    expect((await patchMessage(firstJson.message.id, update, firstJson.editToken)).status).toBe(404);
    expect((await patchMessage(firstJson.message.id, update, secondJson.editToken)).status).toBe(200);
  });

  it('lets only one of several signers racing for the same spot have it', async () => {
    const signers = 5;
    const geometry = await freeSpot('Me first');

    // Hold every request at the start of its transaction until all of them are there, so they
    // really run at the same time. Only the layout lock can then keep two of them apart.
    const transaction = prisma.$transaction.bind(prisma);
    let arrived = 0;
    let release = () => {};
    const allArrived = new Promise<void>((resolve) => (release = resolve));
    const spy = vi.spyOn(prisma, '$transaction').mockImplementation((async (...args: unknown[]) => {
      if (++arrived === signers) release();
      await allArrived;
      return (transaction as (...a: unknown[]) => unknown)(...args);
    }) as typeof prisma.$transaction);

    try {
      const responses = await Promise.all(
        Array.from({ length: signers }, (_, i) =>
          postMessage(
            { text: 'Me first', fontFamily: 'Allura', requestId: `race-request-${String(i).padStart(4, '0')}`, geometry },
            { ip: `192.0.2.${i + 1}` },
          ),
        ),
      );
      expect(arrived).toBe(signers);
      const statuses = responses.map((response) => response.status).sort();
      expect(statuses).toEqual([201, 409, 409, 409, 409]);
      expect(await prisma.message.count()).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('refuses requests that are not from this site or not JSON', async () => {
    const body = await validMessage();
    expect((await postMessage(body, { origin: 'http://evil.test' })).status).toBe(403);
    expect((await postMessage(body, { origin: null })).status).toBe(403);
    expect((await postMessage(body, { contentType: 'text/plain' })).status).toBe(415);
    expect((await postMessage(body, { rawBody: 'x'.repeat(3000) })).status).toBe(413);

    const badJson = await postMessage(body, { rawBody: '{' });
    expect(badJson.status).toBe(400);
    expect((await badJson.json()).error).toBe('invalid_json');

    const invalid = await postMessage({ ...body, fontFamily: 'Comic Sans MS' });
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error).toBe('invalid_message');
    expect(await prisma.message.count()).toBe(0);
  });

  it('pretends to accept a filled-in honeypot but saves nothing', async () => {
    const response = await postMessage({ ...(await validMessage()), hp_extra: 'http://spam.example' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: null });
    expect(await prisma.message.count()).toBe(0);
  });

  it('limits how often one address can sign', async () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      expect((await postMessage(await validMessage(`Note ${i}`))).status).toBe(201);
    }
    const limited = await postMessage(await validMessage('One too many'));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);

    expect((await postMessage(await validMessage('Someone else'), { ip: '198.51.100.9' })).status).toBe(201);
  });

  it('refuses new messages once the card holds the maximum number', async () => {
    await prisma.message.createMany({
      data: Array.from({ length: MAX_MESSAGES }, (_, i) => ({
        text: `Message ${i}`,
        fontFamily: 'Allura',
        placeX: ((i % 8) + 0.5) / 8,
        placeY: (Math.floor(i / 8) + 0.5) / 8,
        placeWidth: 0.02,
        placeHeight: 0.02,
        placeRotation: 0,
      })),
    });
    const response = await postMessage({ text: 'Too late', fontFamily: 'Allura' });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe('card_full');
  });
});
