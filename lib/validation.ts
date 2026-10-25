import { ALLOWED_FONTS, MAX_MESSAGE_LENGTH, MAX_MESSAGE_LINES } from '@/lib/config';

export interface ValidMessage {
  text: string;
  fontFamily: string;
}

export type ValidationResult =
  | { ok: true; data: ValidMessage }
  | { ok: false; message: string };

// Control characters (except tab and newline), zero-width and bidi marks, the
// word joiner range, soft hyphen, BOM and blank-looking filler letters.
const INVISIBLE =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u00AD\u115F\u1160\u200B-\u200F\u2028-\u202E\u2060-\u206F\u3164\uFEFF\uFFA0]/g;

/** Removes invisible characters and tidies whitespace, so blank-looking text counts as empty. */
export function sanitizeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, ' ')
    .replace(INVISIBLE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function validateMessage(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, message: 'Request body must be a JSON object.' };
  }

  const { text, fontFamily } = body as Record<string, unknown>;

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

  return { ok: true, data: { text: cleaned, fontFamily } };
}
