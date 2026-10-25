/** Share of the card's width a drag must reach, at the moment of release, to flip the card. */
const FLIP_WIDTH_SHARE = 0.33;
const MIN_FLIP_DISTANCE_PX = 90;
const MAX_FLIP_DISTANCE_PX = 300;

/** Degrees the card has turned when it is dragged exactly to the flip distance. */
export const FLIP_PREVIEW_DEGREES = 36;

export function flipDistance(cardWidth: number): number {
  return Math.min(MAX_FLIP_DISTANCE_PX, Math.max(MIN_FLIP_DISTANCE_PX, cardWidth * FLIP_WIDTH_SHARE));
}

/** 1 or -1: which way the card turns. Taken from the longer side of the drag, once, when it starts. */
export function dragDirection(dx: number, dy: number): 1 | -1 {
  const offset = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
  return offset < 0 ? -1 : 1;
}

/** 1 when the card has been pulled the flip distance from its rest position. Uses the current offset, not the furthest point reached. */
export function flipProgress(dx: number, dy: number, distance: number): number {
  return Math.hypot(dx, dy) / distance;
}

/** Follows the finger up to the flip distance, then resists, so passing it is felt. */
export function resist(progress: number): number {
  return progress <= 1 ? progress : Math.min(1.4, 1 + (progress - 1) * 0.25);
}
