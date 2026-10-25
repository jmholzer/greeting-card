/** Share of the card's width a drag must reach, at the moment of release, to flip the card. */
const FLIP_WIDTH_SHARE = 0.33;
const MIN_FLIP_DISTANCE_PX = 90;
const MAX_FLIP_DISTANCE_PX = 300;

/** Degrees the card has turned when it is dragged exactly to the flip distance. */
export const FLIP_PREVIEW_DEGREES = 36;

export function flipDistance(cardWidth: number): number {
  return Math.min(MAX_FLIP_DISTANCE_PX, Math.max(MIN_FLIP_DISTANCE_PX, cardWidth * FLIP_WIDTH_SHARE));
}

/** The longer side of the drag, with its sign. The card turns the same way whichever way it is pulled. */
export function dominantOffset(dx: number, dy: number): number {
  return Math.abs(dx) >= Math.abs(dy) ? dx : dy;
}

/** 1 when the drag has reached the flip distance. Uses the current offset, not the furthest point reached. */
export function flipProgress(dx: number, dy: number, distance: number): number {
  return Math.abs(dominantOffset(dx, dy)) / distance;
}

/** Follows the finger up to the flip distance, then resists, so passing it is felt. */
export function resist(progress: number): number {
  return progress <= 1 ? progress : Math.min(1.4, 1 + (progress - 1) * 0.25);
}
