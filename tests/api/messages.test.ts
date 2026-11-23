import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/messages/route';
import { signCard } from './helpers';

describe('GET /api/messages', () => {
  it('lists messages oldest first without any secrets', async () => {
    const ids = [];
    for (const text of ['First', 'Second', 'Third']) ids.push((await signCard(text)).id);

    const response = await GET();
    expect(response.status).toBe(200);
    const messages = await response.json();
    expect(messages.map((message: { id: number }) => message.id)).toEqual(ids);
    for (const message of messages) {
      expect(Object.keys(message).sort()).toEqual(['box', 'createdAt', 'fontFamily', 'id', 'text', 'updatedAt']);
    }
    expect(JSON.stringify(messages)).not.toMatch(/editToken|requestId/);
  });
});
