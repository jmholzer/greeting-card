import { describe, expect, it } from 'vitest';
import { createEditToken, editTokenMatches, getBearerToken, hashEditToken } from '@/lib/editToken';

const withAuth = (value?: string) =>
  new Request('http://localhost/api/message/1', value === undefined ? {} : { headers: { authorization: value } });

describe('createEditToken', () => {
  it('returns a random base64url token and its hash', () => {
    const first = createEditToken();
    const second = createEditToken();
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.hash).toBe(hashEditToken(first.token));
    expect(first.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(second.token).not.toBe(first.token);
  });
});

describe('editTokenMatches', () => {
  const { token, hash } = createEditToken();

  it('accepts the right token', () => {
    expect(editTokenMatches(hash, token)).toBe(true);
  });

  it('refuses a wrong or missing token', () => {
    expect(editTokenMatches(hash, createEditToken().token)).toBe(false);
    expect(editTokenMatches(hash, null)).toBe(false);
  });

  it('refuses when no hash is stored, even for the dummy value', () => {
    expect(editTokenMatches(null, token)).toBe(false);
    expect(editTokenMatches(undefined, token)).toBe(false);
    expect(editTokenMatches(null, 'no-such-message')).toBe(false);
  });
});

describe('getBearerToken', () => {
  it('reads a well-formed bearer token', () => {
    const token = 'a'.repeat(16);
    expect(getBearerToken(withAuth(`Bearer ${token}`))).toBe(token);
    expect(getBearerToken(withAuth(`Bearer ${'Z9_-'.repeat(32)}`))).toBe('Z9_-'.repeat(32));
  });

  it('refuses anything else', () => {
    expect(getBearerToken(withAuth())).toBeNull();
    expect(getBearerToken(withAuth(`Bearer ${'a'.repeat(15)}`))).toBeNull();
    expect(getBearerToken(withAuth(`Bearer ${'a'.repeat(129)}`))).toBeNull();
    expect(getBearerToken(withAuth(`Bearer ${'a'.repeat(15)}+`))).toBeNull();
    expect(getBearerToken(withAuth(`bearer ${'a'.repeat(16)}`))).toBeNull();
    expect(getBearerToken(withAuth(`Basic ${'a'.repeat(16)}`))).toBeNull();
  });
});
