// The card back is a 4x4 grid, so it can hold at most 16 messages.
export const MAX_MESSAGES = 16;

// Stable ordering: oldest message first, id as a tiebreaker for equal timestamps.
export const MESSAGE_ORDER = [{ createdAt: 'asc' as const }, { id: 'asc' as const }];

export const MAX_MESSAGE_LENGTH = 100;

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
