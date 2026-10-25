// The card back is a 4x4 grid, so it can hold at most 16 messages.
export const MAX_MESSAGES = 16;

// Stable ordering: oldest message first, id as a tiebreaker for equal timestamps.
export const MESSAGE_ORDER = [{ createdAt: 'asc' as const }, { id: 'asc' as const }];

export const MAX_MESSAGE_LENGTH = 100;

// Keeps a message from being a column of blank lines.
export const MAX_MESSAGE_LINES = 4;

// Single source of truth for the fonts a message can use. app/fonts.ts maps
// each of these to a next/font class name.
export const ALLOWED_FONTS = [
  'Dancing Script',
  'Allura',
  'Alex Brush',
  'Parisienne',
  'Dynalight',
  'Great Vibes',
  'Grape Nuts',
  'Gloria Hallelujah',
] as const;

export type FontName = (typeof ALLOWED_FONTS)[number];

// Per-client limit on POST /api/message: RATE_LIMIT_MAX requests per window.
export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;

// Requests that fail validation are counted in their own, larger bucket.
export const RATE_LIMIT_INVALID_MAX = 30;

// Failed admin logins per window.
export const RATE_LIMIT_ADMIN_MAX = 10;

// Clients whose address cannot be determined in production share one bucket
// with this many times the normal limit.
export const RATE_LIMIT_UNKNOWN_FACTOR = 6;

// Card front image. Set NEXT_PUBLIC_CARD_FRONT_URL to a local path (e.g. "/front.jpg"
// for a file in public/) or an https URL. Remote hosts must also be allowed in
// next.config.mjs, which does this automatically for the URL set here.
export const DEFAULT_CARD_FRONT = '/card-front-default.jpg';
export const CARD_FRONT_SRC =
  (process.env.NEXT_PUBLIC_CARD_FRONT_URL ?? '').trim() || DEFAULT_CARD_FRONT;

// Page background colour. Set NEXT_PUBLIC_CARD_BACKGROUND_COLOR to a hex colour
// (#e66b1e), a colour name (tomato) or rgb()/hsl() value. Anything else is
// ignored so the variable cannot inject arbitrary CSS.
export const DEFAULT_CARD_BACKGROUND_COLOR = '#e66b1e';

const SAFE_COLOR =
  /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|[a-z]{3,20}|(rgb|rgba|hsl|hsla)\([0-9a-z.,%\s/-]{1,40}\))$/i;

export function resolveBackgroundColor(value: string | undefined): string {
  const color = (value ?? '').trim();
  return SAFE_COLOR.test(color) ? color : DEFAULT_CARD_BACKGROUND_COLOR;
}

export const CARD_BACKGROUND_COLOR = resolveBackgroundColor(
  process.env.NEXT_PUBLIC_CARD_BACKGROUND_COLOR,
);
