// Placement of a message on the card's writing surface. Shared by the browser and the
// server, so both apply exactly the same rules.
//
// A box is stored as fractions of the surface, so it looks the same on every screen:
// x and y are the centre, width and height are the size, rotation is in degrees.
// Rotation and overlap are worked out in a space where the surface is
// SURFACE_ASPECT wide and 1 high, so rotated boxes keep their true shape.
//
// The box stored for a message is its footprint: the tight bounds of the rendered text plus
// a small padding. It is also the area other signers may not overlap.

export interface Geometry {
  /** Centre, as a fraction of the surface width (0 to 1). */
  x: number;
  /** Centre, as a fraction of the surface height (0 to 1). */
  y: number;
  /** Fraction of the surface width. */
  width: number;
  /** Fraction of the surface height. */
  height: number;
  /** Degrees, clockwise. */
  rotation: number;
}

/** Surface width divided by height. The card is an A-series sheet, close to 1.41. */
export const SURFACE_ASPECT = 1.41;

/** A box may cover at most this share of the surface, whatever its proportions. */
export const MAX_BOX_AREA = 1 / 16;

// Sizes the editor uses are kept a little under the limit, so rounding can never push one over it.
export const MAX_BOX_AREA_EDITOR = MAX_BOX_AREA * 0.998;

/** Smallest box a message may have, as fractions of the surface. Whether the text is legible is checked separately. */
export const MIN_BOX_WIDTH = 0.02;
export const MIN_BOX_HEIGHT = 0.02;

/** A box of this size is what must still fit for the card to count as open for signing. */
export const SIGN_MIN_WIDTH = 0.1;
export const SIGN_MIN_HEIGHT = 0.07;

/**
 * The footprint must give every character at least this share of the surface, or the text
 * would be too small to read. The server cannot measure fonts, so this is its plausibility check.
 */
export const MIN_AREA_PER_CHARACTER = 6e-5;

/**
 * The footprint must also be wide enough to hold the longest word without splitting it, at a
 * readable size. This much of the surface width per letter, a little under the width a letter
 * has at the smallest readable size.
 */
export const MIN_WIDTH_PER_LETTER = 0.0045;

/**
 * The space kept around the text inside its footprint, on each side. Two messages can
 * sit with their footprints touching, so their text is twice this far apart: about 5px.
 * Stored as a fraction of the surface height, so it is worked out against a reference
 * card of REFERENCE_SURFACE_HEIGHT pixels. A phone card (about 235px high) ends up near
 * 3px and a desktop card (about 600px high) near 8px.
 */
export const FOOTPRINT_PADDING_PX = 2.5;
export const REFERENCE_SURFACE_HEIGHT = 380;
export const FOOTPRINT_PADDING = FOOTPRINT_PADDING_PX / REFERENCE_SURFACE_HEIGHT;

export const MAX_ROTATION = 30;

// Free space kept between two footprints, in surface heights. The padding inside each footprint is the real gap.
export const BOX_GAP = 0;

const EPSILON = 1e-9;

// Rounding the centre or size to 4 decimals can leave a corner a hair outside the surface.
const BOUNDS_TOLERANCE = 2e-4;
const DECIMALS = 10000;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * DECIMALS) / DECIMALS;

export function roundGeometry(box: Geometry): Geometry {
  return {
    x: round(box.x),
    y: round(box.y),
    width: round(box.width),
    height: round(box.height),
    rotation: round(box.rotation),
  };
}

type Point = [number, number];

function corners(box: Geometry, inflate = 0): Point[] {
  const halfWidth = (box.width * SURFACE_ASPECT) / 2 + inflate;
  const halfHeight = box.height / 2 + inflate;
  const radians = (box.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const cx = box.x * SURFACE_ASPECT;
  const cy = box.y;
  return (
    [
      [-halfWidth, -halfHeight],
      [halfWidth, -halfHeight],
      [halfWidth, halfHeight],
      [-halfWidth, halfHeight],
    ] as Point[]
  ).map(([px, py]) => [cx + px * cos - py * sin, cy + px * sin + py * cos]);
}

/** Half the width and height of the smallest upright rectangle around the box, as fractions of the surface. */
function halfExtents(box: Geometry): { x: number; y: number } {
  const radians = (box.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const width = box.width * SURFACE_ASPECT;
  return {
    x: ((cos * width + sin * box.height) / 2) / SURFACE_ASPECT,
    y: (sin * width + cos * box.height) / 2,
  };
}

/** True when every corner of the rotated box is on the surface. */
export function isInside(box: Geometry): boolean {
  return corners(box).every(
    ([px, py]) =>
      px >= -BOUNDS_TOLERANCE &&
      px <= SURFACE_ASPECT + BOUNDS_TOLERANCE &&
      py >= -BOUNDS_TOLERANCE &&
      py <= 1 + BOUNDS_TOLERANCE,
  );
}

/** Moves the centre the least needed to bring the whole rotated box onto the surface. */
export function clampInside(box: Geometry): Geometry {
  const half = halfExtents(box);
  return {
    ...box,
    x: clamp(box.x, half.x, 1 - half.x),
    y: clamp(box.y, half.y, 1 - half.y),
  };
}

function projection(points: Point[], axis: Point): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const [px, py] of points) {
    const value = px * axis[0] + py * axis[1];
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return [min, max];
}

/** True when two rotated boxes touch or come closer than BOX_GAP (separating axis test). */
export function boxesOverlap(a: Geometry, b: Geometry): boolean {
  const first = corners(a, BOX_GAP / 2);
  const second = corners(b, BOX_GAP / 2);
  for (const points of [first, second]) {
    for (let i = 0; i < 2; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[i + 1];
      const axis: Point = [y2 - y1, x1 - x2];
      const [minA, maxA] = projection(first, axis);
      const [minB, maxB] = projection(second, axis);
      if (maxA <= minB + EPSILON || maxB <= minA + EPSILON) return false;
    }
  }
  return true;
}

export function overlapsAny(box: Geometry, others: Geometry[]): boolean {
  return others.some((other) => boxesOverlap(box, other));
}

export type GeometryProblem = 'size' | 'area' | 'small' | 'bounds' | 'overlap';

/** How many characters count towards the legibility rule: everything but whitespace. */
export function countCharacters(text: string): number {
  return text.replace(/\s/g, '').length;
}

/** Letters in the longest run of characters without whitespace. */
export function longestWord(text: string): number {
  let longest = 0;
  for (const word of text.split(/\s+/)) longest = Math.max(longest, [...word].length);
  return longest;
}

/**
 * Checks the rules a box must meet whatever else is on the card, then (if given) overlap
 * with other boxes. With `text`, a box too small for that many characters is refused too.
 */
export function checkGeometry(
  box: Geometry,
  others: Geometry[] = [],
  text?: string,
): GeometryProblem | null {
  if (
    box.width < MIN_BOX_WIDTH - EPSILON ||
    box.height < MIN_BOX_HEIGHT - EPSILON ||
    box.width > 1 + EPSILON ||
    box.height > 1 + EPSILON ||
    Math.abs(box.rotation) > MAX_ROTATION + EPSILON
  ) {
    return 'size';
  }
  if (box.width * box.height > MAX_BOX_AREA + EPSILON) return 'area';
  if (
    text !== undefined &&
    (box.width * box.height < countCharacters(text) * MIN_AREA_PER_CHARACTER ||
      box.width < longestWord(text) * MIN_WIDTH_PER_LETTER)
  ) {
    return 'small';
  }
  if (!isInside(box)) return 'bounds';
  if (overlapsAny(box, others)) return 'overlap';
  return null;
}

export const GEOMETRY_MESSAGES: Record<GeometryProblem, string> = {
  size: 'The message box is too small, too large or turned too far.',
  area: 'The message box is bigger than one sixteenth of the card.',
  small: 'The message is too small to read.',
  bounds: 'The message box must stay on the card.',
  overlap: 'That spot is taken. Please pick another one.',
};

export type GeometryParse = { ok: true; data: Geometry } | { ok: false; message: string };

/** Reads an untrusted `{ x, y, width, height, rotation }` object. Numbers are rounded to 4 decimals. */
export function parseGeometry(value: unknown): GeometryParse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, message: '"geometry" must be an object.' };
  }
  const record = value as Record<string, unknown>;
  const numbers: Partial<Geometry> = {};
  for (const key of ['x', 'y', 'width', 'height', 'rotation'] as const) {
    const field = record[key];
    if (typeof field !== 'number' || !Number.isFinite(field) || Math.abs(field) > 1000) {
      return { ok: false, message: `"geometry.${key}" must be a number.` };
    }
    numbers[key] = field;
  }
  return { ok: true, data: roundGeometry(numbers as Geometry) };
}

/** Largest width and height, in that proportion, that stay within the area limit. */
export function limitArea(width: number, height: number): { width: number; height: number } {
  const area = width * height;
  if (area <= MAX_BOX_AREA_EDITOR) return { width, height };
  const scale = Math.sqrt(MAX_BOX_AREA_EDITOR / area);
  return { width: width * scale, height: height * scale };
}

/** Brings a size within the minimum and the area limit. */
export function clampSize(width: number, height: number): { width: number; height: number } {
  const limited = limitArea(
    clamp(width, MIN_BOX_WIDTH, 1),
    clamp(height, MIN_BOX_HEIGHT, 1),
  );
  // Scaling down for the area limit can go under a minimum, so the minimum wins and the other side gives way.
  const w = Math.max(MIN_BOX_WIDTH, limited.width);
  const h = Math.max(MIN_BOX_HEIGHT, Math.min(limited.height, MAX_BOX_AREA_EDITOR / w));
  return { width: w, height: h };
}

/** How small a box may be and still hold this text. The sides are limits, not one fixed shape. */
export interface TextLimits {
  /** Narrowest the box may be, so the longest word still fits. */
  minWidth: number;
  /** Shortest the box may be. */
  minHeight: number;
  /** Smallest area that keeps the text readable. */
  minArea: number;
}

/**
 * The limits a box must meet to hold this text. A wider box may be shorter, and the other
 * way round, as long as both limits and the area hold. Null when the text needs more than
 * the area limit allows, so it cannot be placed at all.
 */
export function textLimits(text: string): TextLimits | null {
  const minWidth = Math.max(MIN_BOX_WIDTH, longestWord(text) * MIN_WIDTH_PER_LETTER);
  const minArea = Math.max(minWidth * MIN_BOX_HEIGHT, countCharacters(text) * MIN_AREA_PER_CHARACTER);
  const widest = Math.min(1, MAX_BOX_AREA / MIN_BOX_HEIGHT);
  const minHeight = Math.max(MIN_BOX_HEIGHT, minArea / widest);
  if (minWidth > widest + EPSILON || minArea > MAX_BOX_AREA + EPSILON) return null;
  return { minWidth, minHeight, minArea };
}

/**
 * A slightly larger box in the same place, grown towards the size this text needs.
 * The width a long word needs is kept, and the height gives way so the area stays
 * within the limit. Returns null when the box cannot grow without breaking that limit.
 */
export function growBox(box: Geometry, limits: TextLimits): Geometry | null {
  const width = Math.min(1, Math.max(box.width * 1.15, limits.minWidth));
  let height = Math.min(1, Math.max(box.height * 1.15, MIN_BOX_HEIGHT, limits.minArea / width));
  if (width * height > MAX_BOX_AREA_EDITOR) height = Math.min(1, MAX_BOX_AREA_EDITOR / width);
  if (height < MIN_BOX_HEIGHT - EPSILON || width * height > MAX_BOX_AREA + EPSILON) return null;
  const next = clampInside({ ...box, width, height });
  const same = (['x', 'y', 'width', 'height', 'rotation'] as const).every(
    (key) => Math.abs(next[key] - box[key]) <= 5e-5,
  );
  return same ? null : next;
}

/** A size that suits the length of the text, in proportions a signature fits well. */
export function defaultSize(textLength: number): { width: number; height: number } {
  const area = clamp(0.02 + textLength * 0.0006, 0.02, 0.058);
  const height = Math.sqrt((area * SURFACE_ASPECT) / 1.5);
  return clampSize((1.5 * height) / SURFACE_ASPECT, height);
}

const SCAN_STEP = 0.02;
const FIT_STEP = 0.01;

/**
 * Finds a free place for a box of about this size: the spot farthest from the other
 * boxes and the edges, so a signer can usually accept it as it is, or the free spot
 * closest to `near` (keeping its turn) when that is given. Tries smaller sizes if the
 * card is crowded, but never below the size the text needs to stay readable. Returns
 * null when no valid box fits.
 */
export function findFreeSpot(
  others: Geometry[],
  size: { width: number; height: number } = defaultSize(40),
  near?: Geometry,
  text?: string,
): Geometry | null {
  const limits = limitsFor(text);
  if (!limits) return null;

  for (const fitted of sizesFor(size, limits)) {
    const spot = bestSpot(others, fitted.width, fitted.height, SCAN_STEP, near);
    if (spot && checkGeometry(spot, others, text) === null) return spot;
  }
  // A finer pass at the smallest shapes, for a gap the coarse scan stepped over.
  for (const fitted of sizesFor({ width: limits.minWidth, height: limits.minHeight }, limits)) {
    const spot = bestSpot(others, fitted.width, fitted.height, FIT_STEP, near);
    if (spot && checkGeometry(spot, others, text) === null) return spot;
  }
  return null;
}

/** The limits that apply: the text's, or the smallest box a signer is offered when there is no text. */
function limitsFor(text: string | undefined): TextLimits | null {
  if (text === undefined) {
    return { minWidth: SIGN_MIN_WIDTH, minHeight: SIGN_MIN_HEIGHT, minArea: SIGN_MIN_WIDTH * SIGN_MIN_HEIGHT };
  }
  return textLimits(text);
}

/**
 * Sizes to try, biggest first. The requested size is grown until it meets the limits, then
 * shrunk back down, and a spread of wider-shorter and narrower-taller shapes is added so a
 * gap that suits one proportion is not missed.
 */
function sizesFor(
  size: { width: number; height: number },
  limits: TextLimits,
): { width: number; height: number }[] {
  const sizes: { width: number; height: number }[] = [];
  const add = (width: number, height: number) => {
    if (width < limits.minWidth - EPSILON || height < limits.minHeight - EPSILON) return;
    if (width * height < limits.minArea - EPSILON) return;
    if (width * height > MAX_BOX_AREA + EPSILON || width > 1 + EPSILON || height > 1 + EPSILON) return;
    if (sizes.some((s) => Math.abs(s.width - width) < 1e-4 && Math.abs(s.height - height) < 1e-4)) return;
    sizes.push({ width, height });
  };

  let width = Math.max(size.width, limits.minWidth);
  let height = Math.max(size.height, limits.minHeight, limits.minArea / width);
  if (width * height > MAX_BOX_AREA) {
    const fitted = clampSize(width, height);
    width = Math.max(limits.minWidth, fitted.width);
    height = Math.max(limits.minHeight, fitted.height, limits.minArea / width);
  }
  for (let shrink = 1; shrink >= 0.5 - EPSILON; shrink -= 0.1) {
    const w = Math.max(limits.minWidth, width * shrink);
    add(w, Math.max(limits.minHeight, height * shrink, limits.minArea / w));
  }

  const widest = Math.min(1, MAX_BOX_AREA / limits.minHeight);
  for (const fraction of [0, 0.5, 1]) {
    const w = limits.minWidth + (widest - limits.minWidth) * fraction;
    add(w, Math.max(limits.minHeight, limits.minArea / w));
  }
  return sizes;
}

// Positions to try along one axis: the middle first, then outwards in both directions.
function scanPositions(half: number, step: number): number[] {
  const positions: number[] = [];
  for (let k = 0; 0.5 - k * step >= half - EPSILON; k++) {
    positions.push(0.5 - k * step);
    if (k > 0) positions.push(0.5 + k * step);
  }
  return positions;
}

function bestSpot(
  others: Geometry[],
  width: number,
  height: number,
  step: number,
  near?: Geometry,
): Geometry | null {
  const base: Geometry = { x: 0.5, y: 0.5, width, height, rotation: near?.rotation ?? 0 };
  const half = halfExtents(base);
  let best: Geometry | null = null;
  let bestClearance = -Infinity;
  for (const y of scanPositions(half.y, step)) {
    for (const x of scanPositions(half.x, step)) {
      const candidate = roundGeometry({ ...base, x, y });
      if (overlapsAny(candidate, others)) continue;
      let clearance: number;
      if (near) {
        clearance = -Math.hypot((candidate.x - near.x) * SURFACE_ASPECT, candidate.y - near.y);
      } else {
        clearance = Math.min(
          candidate.x * SURFACE_ASPECT,
          (1 - candidate.x) * SURFACE_ASPECT,
          candidate.y,
          1 - candidate.y,
        );
        for (const other of others) {
          clearance = Math.min(
            clearance,
            Math.hypot((candidate.x - other.x) * SURFACE_ASPECT, candidate.y - other.y),
          );
        }
      }
      if (clearance > bestClearance + EPSILON) {
        best = candidate;
        bestClearance = clearance;
      }
    }
  }
  return best;
}

/**
 * True when a smallest box still fits somewhere; false means the card is full.
 * With `text`, the box must also be big enough for that text to stay readable.
 */
export function hasRoomForMinimumBox(others: Geometry[], text?: string): boolean {
  const limits = limitsFor(text);
  if (!limits) return false;
  return findFreeSpot(others, { width: limits.minWidth, height: limits.minHeight }, undefined, text) !== null;
}
