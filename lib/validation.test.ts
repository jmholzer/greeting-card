import { describe, expect, it } from 'vitest';
import { sanitizeText, validateMessage } from '@/lib/validation';
import { MAX_MESSAGE_LENGTH, MAX_MESSAGE_LINES } from '@/lib/config';

describe('sanitizeText', () => {
  it('removes invisible characters', () => {
    expect(sanitizeText('he​llo')).toBe('hello');
    expect(sanitizeText('‮abc')).toBe('abc');
    expect(sanitizeText('﻿abc')).toBe('abc');
    expect(sanitizeText('a\u0007b')).toBe('ab');
    expect(sanitizeText('a­b')).toBe('ab');
  });

  it('keeps joiners that real text needs', () => {
    const family = '\u{1F468}‍\u{1F469}‍\u{1F467}';
    expect(sanitizeText(family)).toBe(family);
    const persian = 'می‌خواهم';
    expect(sanitizeText(persian)).toBe(persian);
  });

  it('trims whitespace and joiners at the edges', () => {
    expect(sanitizeText('  hi  ')).toBe('hi');
    expect(sanitizeText('‍ hi ‌')).toBe('hi');
  });

  it('collapses three or more line breaks into one blank line', () => {
    expect(sanitizeText('a\n\n\n\nb')).toBe('a\n\nb');
    expect(sanitizeText('a\n‍\n‍\nb')).toBe('a\n\nb');
    expect(sanitizeText('a\n\nb')).toBe('a\n\nb');
  });

  it('normalises line endings and tabs', () => {
    expect(sanitizeText('a\r\nb')).toBe('a\nb');
    expect(sanitizeText('a\rb')).toBe('a\nb');
    expect(sanitizeText('a\tb')).toBe('a b');
  });

  it('treats blank-looking text as empty', () => {
    expect(sanitizeText('')).toBe('');
    expect(sanitizeText('  ‍ \n ')).toBe('');
    expect(sanitizeText('​﻿')).toBe('');
  });
});

describe('validateMessage', () => {
  const valid = {
    text: 'Happy birthday!',
    fontFamily: 'Allura',
    requestId: 'abcdefghijklmnop',
    geometry: { x: 0.5, y: 0.5, width: 0.2, height: 0.1, rotation: 5 },
  };

  const errorFor = (body: unknown) => {
    const result = validateMessage(body);
    return result.ok ? null : result.message;
  };

  it('accepts a valid message and returns the cleaned text', () => {
    expect(validateMessage({ ...valid, text: '  Happy birthday!​ ' })).toEqual({
      ok: true,
      data: { ...valid, text: 'Happy birthday!' },
    });
  });

  it('treats requestId and geometry as optional', () => {
    expect(validateMessage({ text: 'Hi', fontFamily: 'Allura' })).toEqual({
      ok: true,
      data: { text: 'Hi', fontFamily: 'Allura', requestId: null, geometry: null },
    });
    expect(validateMessage({ ...valid, requestId: null, geometry: null })).toMatchObject({ ok: true });
  });

  it('rounds the geometry', () => {
    const result = validateMessage({ ...valid, geometry: { ...valid.geometry, x: 0.123456 } });
    expect(result.ok && result.data.geometry?.x).toBe(0.1235);
  });

  it('refuses a body that is not an object', () => {
    expect(errorFor(null)).toBe('Request body must be a JSON object.');
    expect(errorFor([])).toBe('Request body must be a JSON object.');
    expect(errorFor('hi')).toBe('Request body must be a JSON object.');
  });

  it('refuses bad text', () => {
    expect(errorFor({ ...valid, text: 5 })).toBe('"text" must be a string.');
    expect(errorFor({ ...valid, text: ' ​ ' })).toBe('"text" must not be empty.');
    expect(errorFor({ ...valid, text: 'a'.repeat(MAX_MESSAGE_LENGTH + 1), geometry: null })).toBe(
      `"text" must be at most ${MAX_MESSAGE_LENGTH} characters.`,
    );
    expect(errorFor({ ...valid, text: 'a\nb\nc\nd\ne' })).toBe(
      `"text" must be at most ${MAX_MESSAGE_LINES} lines.`,
    );
  });

  it('counts the length after cleaning', () => {
    const padded = `  ${'a'.repeat(MAX_MESSAGE_LENGTH)}​  `;
    expect(errorFor({ ...valid, text: padded, geometry: null })).toBeNull();
  });

  it('refuses fonts that are not allowed', () => {
    expect(errorFor({ ...valid, fontFamily: 1 })).toBe('"fontFamily" must be a string.');
    expect(errorFor({ ...valid, fontFamily: 'Comic Sans MS' })).toBe('"fontFamily" is not an allowed font.');
  });

  it('refuses a malformed requestId', () => {
    const message = '"requestId" must be 16 to 64 letters, digits, "-" or "_".';
    expect(errorFor({ ...valid, requestId: 'short' })).toBe(message);
    expect(errorFor({ ...valid, requestId: 'a'.repeat(65) })).toBe(message);
    expect(errorFor({ ...valid, requestId: 'abcdefghijklmno!' })).toBe(message);
    expect(errorFor({ ...valid, requestId: 1234567890123456 })).toBe(message);
  });

  it('refuses bad geometry', () => {
    expect(errorFor({ ...valid, geometry: 'middle' })).toBe('"geometry" must be an object.');
    expect(errorFor({ ...valid, geometry: { ...valid.geometry, rotation: 45 } })).toBe(
      'The message box is too small, too large or turned too far.',
    );
    expect(errorFor({ ...valid, geometry: { ...valid.geometry, x: 0 } })).toBe(
      'The message box must stay on the card.',
    );
  });

  it('refuses a box too small for the text', () => {
    expect(errorFor({ ...valid, text: 'a'.repeat(60) })).toBe('The message is too small to read.');
  });
});
