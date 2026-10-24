// The card back is a 4x4 grid, so it can hold at most 16 messages.
export const MAX_MESSAGES = 16;

// Stable ordering: oldest message first, id as a tiebreaker for equal timestamps.
export const MESSAGE_ORDER = [{ createdAt: 'asc' as const }, { id: 'asc' as const }];
