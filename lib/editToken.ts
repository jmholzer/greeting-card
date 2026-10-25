import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/** Hex SHA-256 of an edit token. Only this hash is ever stored. */
export function hashEditToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** A new random edit token (256 bits, base64url) and the hash to store for it. */
export function createEditToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashEditToken(token) };
}

/** The raw token from an `Authorization: Bearer <token>` header, or null. */
export function getBearerToken(request: Request): string | null {
  const match = /^Bearer ([A-Za-z0-9_-]{16,128})$/.exec(request.headers.get('authorization') ?? '');
  return match ? match[1] : null;
}

// Compared when the id is unknown or the message has no token, so those cases
// take the same path (and time) as a wrong token.
const DUMMY_HASH = hashEditToken('no-such-message');

/** Timing-safe check of a presented token against a stored hash (which may be missing). */
export function editTokenMatches(storedHash: string | null | undefined, token: string | null): boolean {
  const expected = Buffer.from(storedHash ?? DUMMY_HASH, 'hex');
  const actual = Buffer.from(hashEditToken(token ?? ''), 'hex');
  const equal = expected.length === actual.length && timingSafeEqual(expected, actual);
  return equal && Boolean(storedHash) && token !== null;
}
