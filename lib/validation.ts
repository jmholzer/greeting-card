import { ALLOWED_FONTS, MAX_MESSAGE_LENGTH } from '@/lib/config';

export interface ValidMessage {
  text: string;
  fontFamily: string;
}

export type ValidationResult =
  | { ok: true; data: ValidMessage }
  | { ok: false; message: string };

export function validateMessage(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, message: 'Request body must be a JSON object.' };
  }

  const { text, fontFamily } = body as Record<string, unknown>;

  if (typeof text !== 'string') {
    return { ok: false, message: '"text" must be a string.' };
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: '"text" must not be empty.' };
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, message: `"text" must be at most ${MAX_MESSAGE_LENGTH} characters.` };
  }

  if (typeof fontFamily !== 'string') {
    return { ok: false, message: '"fontFamily" must be a string.' };
  }
  if (!(ALLOWED_FONTS as readonly string[]).includes(fontFamily)) {
    return { ok: false, message: '"fontFamily" is not an allowed font.' };
  }

  return { ok: true, data: { text: trimmed, fontFamily } };
}
