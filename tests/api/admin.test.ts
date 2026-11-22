import { afterEach, describe, expect, it } from 'vitest';
import prisma from '@/lib/prisma';
import { RATE_LIMIT_ADMIN_MAX } from '@/lib/config';
import { adminDelete, signCard } from './helpers';

const ADMIN_TOKEN = 'test-admin-token';

describe('DELETE /api/admin/messages/<id>', () => {
  afterEach(() => {
    process.env.ADMIN_TOKEN = ADMIN_TOKEN;
  });

  it('does not exist without ADMIN_TOKEN', async () => {
    const message = await signCard();
    delete process.env.ADMIN_TOKEN;
    expect((await adminDelete(message.id, ADMIN_TOKEN)).status).toBe(404);
    expect(await prisma.message.count()).toBe(1);
  });

  it('refuses a wrong token and then limits further tries', async () => {
    const message = await signCard();
    for (let i = 0; i < RATE_LIMIT_ADMIN_MAX; i++) {
      const response = await adminDelete(message.id, 'wrong-token');
      expect(response.status).toBe(401);
    }
    const limited = await adminDelete(message.id, 'wrong-token');
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await adminDelete(message.id, undefined)).status).toBe(429);
    expect(await prisma.message.count()).toBe(1);
  });

  it('deletes a message with the right token', async () => {
    const message = await signCard();
    const response = await adminDelete(message.id, ADMIN_TOKEN);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: message.id });
    expect(await prisma.message.count()).toBe(0);
  });

  it('answers 404 for an unknown id and 400 for a malformed one', async () => {
    expect((await adminDelete(999, ADMIN_TOKEN)).status).toBe(404);
    expect((await adminDelete('abc', ADMIN_TOKEN)).status).toBe(400);
  });
});
