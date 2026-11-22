import { describe, expect, it } from 'vitest';
import { isSameOrigin } from '@/lib/request';

const request = (headers: Record<string, string>, url = 'http://localhost:3000/api/message') =>
  new Request(url, { method: 'POST', headers });

describe('isSameOrigin', () => {
  it('is false without an Origin header', () => {
    expect(isSameOrigin(request({}))).toBe(false);
  });

  it('compares the origin with the Host header', () => {
    expect(isSameOrigin(request({ origin: 'https://card.example', host: 'card.example' }))).toBe(true);
    expect(isSameOrigin(request({ origin: 'https://evil.example', host: 'card.example' }))).toBe(false);
  });

  it('falls back to the request URL when there is no Host header', () => {
    expect(isSameOrigin(request({ origin: 'http://localhost:3000' }))).toBe(true);
    expect(isSameOrigin(request({ origin: 'http://localhost:3001' }))).toBe(false);
  });

  it('is false for an origin that is not a URL', () => {
    expect(isSameOrigin(request({ origin: 'null' }))).toBe(false);
  });
});
