import { ALLOWED_FONTS, MAX_MESSAGE_LENGTH, MAX_MESSAGE_LINES } from '@/lib/config';
import { checkGeometry, GEOMETRY_MESSAGES, parseGeometry } from '@/lib/geometry';
import type { Geometry } from '@/lib/geometry';

export interface ValidMessage {
  text: string;
  fontFamily: string;
  /** Client-chosen key that makes a retried submit idempotent. */
  requestId: string | null;
  /** Where the message goes on the card, or null to leave it to the server (create) or unchanged (edit). */
  geometry: Geometry | null;
}

const REQUEST_ID = /^[A-Za-z0-9_-]{16,64}$/;

export type ValidationResult =
  | { ok: true; data: ValidMessage }
  | { ok: false; message: string };

// Control characters (except tab and newline), zero-width spaces, bidi embedding
// and override marks, the word joiner range, soft hyphen, BOM and blank-looking
// filler letters. U+200C to U+200F are kept: they join emoji and are needed to
// write some languages (for example Persian and Hindi) correctly.
const INVISIBLE =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u00AD\u115F\u1160\u200B\u2028-\u202E\u2060-\u206F\u3164\uFEFF\uFFA0]/g;

const JOINERS_AND_MARKS = /[\u200C-\u200F]/g;

// Joiners next to whitespace carry no meaning, so they must not stop it being trimmed or collapsed.
const EDGE_BLANKS = /^[\s\u200C-\u200F]+|[\s\u200C-\u200F]+$/g;
const BLANK_LINES = /(?:\n[\u200C-\u200F]*){3,}/g;

/**
 * Removes invisible characters and tidies whitespace. Text that is only
 * whitespace and joiners counts as empty, so blank-looking messages are refused.
 */
export function sanitizeText(text: string): string {
  const cleaned = text
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, ' ')
    .replace(INVISIBLE, '')
    .replace(BLANK_LINES, '\n\n')
    .replace(EDGE_BLANKS, '');
  return cleaned.replace(JOINERS_AND_MARKS, '').trim() === '' ? '' : cleaned;
}

export function validateMessage(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, message: 'Request body must be a JSON object.' };
  }

  const { text, fontFamily, requestId, geometry } = body as Record<string, unknown>;

  if (typeof text !== 'string') {
    return { ok: false, message: '"text" must be a string.' };
  }
  const cleaned = sanitizeText(text);
  if (cleaned.length === 0) {
    return { ok: false, message: '"text" must not be empty.' };
  }
  if (cleaned.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, message: `"text" must be at most ${MAX_MESSAGE_LENGTH} characters.` };
  }
  if (cleaned.split('\n').length > MAX_MESSAGE_LINES) {
    return { ok: false, message: `"text" must be at most ${MAX_MESSAGE_LINES} lines.` };
  }

  if (typeof fontFamily !== 'string') {
    return { ok: false, message: '"fontFamily" must be a string.' };
  }
  if (!(ALLOWED_FONTS as readonly string[]).includes(fontFamily)) {
    return { ok: false, message: '"fontFamily" is not an allowed font.' };
  }

  if (requestId !== undefined && requestId !== null) {
    if (typeof requestId !== 'string' || !REQUEST_ID.test(requestId)) {
      return { ok: false, message: '"requestId" must be 16 to 64 letters, digits, "-" or "_".' };
    }
  }

  let box: Geometry | null = null;
  if (geometry !== undefined && geometry !== null) {
    const parsed = parseGeometry(geometry);
    if (!parsed.ok) return { ok: false, message: parsed.message };
    // Rules that hold wherever the box goes. Overlap depends on the other messages, so it is checked later.
    const problem = checkGeometry(parsed.data);
    if (problem) return { ok: false, message: GEOMETRY_MESSAGES[problem] };
    box = parsed.data;
  }

  return {
    ok: true,
    data: {
      text: cleaned,
      fontFamily,
      requestId: typeof requestId === 'string' ? requestId : null,
      geometry: box,
    },
  };
}
