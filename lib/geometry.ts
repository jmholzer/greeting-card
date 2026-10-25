// Placement of a message on the card's writing surface. Shared by the browser and the
// server, so both apply exactly the same rules.
//
// A box is stored as fractions of the surface, so it looks the same on every screen:
// x and y are the centre, width and height are the size, rotation is in degrees.
// Rotation and overlap are worked out in a space where the surface is
// SURFACE_ASPECT wide and 1 high, so rotated boxes keep their true shape.

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

/** Smallest box, as fractions of the surface, that still leaves a message legible. */
export const MIN_BOX_WIDTH = 0.12;
export const MIN_BOX_HEIGHT = 0.1;

export const MAX_ROTATION = 30;

// Free space kept between two boxes, in surface heights.
export const BOX_GAP = 0.004;

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

export type GeometryProblem = 'size' | 'area' | 'bounds' | 'overlap';

/** Checks the rules a box must meet whatever else is on the card, then (if given) overlap with other boxes. */
export function checkGeometry(box: Geometry, others: Geometry[] = []): GeometryProblem | null {
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
  if (!isInside(box)) return 'bounds';
  if (overlapsAny(box, others)) return 'overlap';
  return null;
}

export const GEOMETRY_MESSAGES: Record<GeometryProblem, string> = {
  size: 'The message box is too small, too large or turned too far.',
  area: 'The message box is bigger than one sixteenth of the card.',
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
 * card is crowded. Returns null when not even a smallest box fits.
 */
export function findFreeSpot(
  others: Geometry[],
  size: { width: number; height: number } = defaultSize(40),
  near?: Geometry,
): Geometry | null {
  for (let shrink = 1; shrink >= 0.5 - EPSILON; shrink -= 0.1) {
    const fitted = clampSize(size.width * shrink, size.height * shrink);
    const spot = bestSpot(others, fitted.width, fitted.height, SCAN_STEP, near);
    if (spot) return spot;
  }
  return bestSpot(others, MIN_BOX_WIDTH, MIN_BOX_HEIGHT, FIT_STEP, near);
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

/** True when a smallest box still fits somewhere; false means the card is full. */
export function hasRoomForMinimumBox(others: Geometry[]): boolean {
  const base: Geometry = { x: 0.5, y: 0.5, width: MIN_BOX_WIDTH, height: MIN_BOX_HEIGHT, rotation: 0 };
  const half = halfExtents(base);
  for (const y of scanPositions(half.y, FIT_STEP)) {
    for (const x of scanPositions(half.x, FIT_STEP)) {
      if (!overlapsAny({ ...base, x, y }, others)) return true;
    }
  }
  return false;
}
