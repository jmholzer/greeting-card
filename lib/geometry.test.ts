import { describe, expect, it } from 'vitest';
import {
  boxesOverlap,
  checkGeometry,
  clampInside,
  clampSize,
  findFreeSpot,
  hasRoomForMinimumBox,
  isInside,
  limitArea,
  MAX_BOX_AREA,
  MAX_BOX_AREA_EDITOR,
  MIN_BOX_HEIGHT,
  MIN_BOX_WIDTH,
  parseGeometry,
  SURFACE_ASPECT,
  textLimits,
} from '@/lib/geometry';
import type { Geometry } from '@/lib/geometry';

const box = (overrides: Partial<Geometry> = {}): Geometry => ({
  x: 0.5,
  y: 0.5,
  width: 0.2,
  height: 0.2,
  rotation: 0,
  ...overrides,
});

/** Small seeded PRNG (mulberry32), so random sweeps are repeatable. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A 4x4 grid of boxes of exactly the area limit that covers the whole surface. */
const fullCard = (): Geometry[] =>
  Array.from({ length: 16 }, (_, i) =>
    box({ x: (i % 4) * 0.25 + 0.125, y: Math.floor(i / 4) * 0.25 + 0.125, width: 0.25, height: 0.25 }),
  );

describe('boxesOverlap', () => {
  it('is false for boxes far apart', () => {
    expect(boxesOverlap(box({ x: 0.2, width: 0.1 }), box({ x: 0.8, width: 0.1 }))).toBe(false);
  });

  it('is false for boxes that only touch along an edge', () => {
    expect(boxesOverlap(box({ x: 0.3 }), box({ x: 0.5 }))).toBe(false);
  });

  it('is true as soon as boxes cross', () => {
    expect(boxesOverlap(box({ x: 0.3 }), box({ x: 0.4999 }))).toBe(true);
  });

  it('is true for a box inside another', () => {
    expect(boxesOverlap(box(), box({ width: 0.05, height: 0.05 }))).toBe(true);
  });

  it('is true for a cross of an upright and a turned box', () => {
    expect(
      boxesOverlap(box({ width: 0.3, height: 0.03 }), box({ width: 0.3, height: 0.03, rotation: 30 })),
    ).toBe(true);
  });

  it('is false for parallel turned boxes whose upright bounds overlap', () => {
    // Two thin boxes turned 30 degrees, moved apart along their normal by more than their height.
    const rotation = 30;
    const radians = (rotation * Math.PI) / 180;
    const distance = 0.05;
    const a = box({ width: 0.3, height: 0.02, rotation });
    const b = {
      ...a,
      x: a.x + (-Math.sin(radians) * distance) / SURFACE_ASPECT,
      y: a.y + Math.cos(radians) * distance,
    };
    // The upright bounds overlap a lot (their centres are much closer than their half heights).
    expect(Math.abs(a.y - b.y)).toBeLessThan(0.1);
    expect(boxesOverlap(a, b)).toBe(false);
    // Moved closer than their height, they do overlap.
    const closer = { ...a, x: a.x + (-Math.sin(radians) * 0.01) / SURFACE_ASPECT, y: a.y + Math.cos(radians) * 0.01 };
    expect(boxesOverlap(a, closer)).toBe(true);
  });

  it('gives the same answer whichever box comes first', () => {
    const random = seeded(1);
    const randomBox = () =>
      box({
        x: random(),
        y: random(),
        width: 0.02 + random() * 0.3,
        height: 0.02 + random() * 0.3,
        rotation: random() * 60 - 30,
      });
    for (let i = 0; i < 500; i++) {
      const a = randomBox();
      const b = randomBox();
      expect(boxesOverlap(a, b)).toBe(boxesOverlap(b, a));
    }
  });
});

describe('isInside and clampInside', () => {
  it('accepts a box whose edge sits on the surface edge', () => {
    expect(isInside(box({ x: 0.1 }))).toBe(true);
  });

  it('refuses a box that a turn pushes over the edge', () => {
    expect(isInside(box({ x: 0.1, rotation: 30 }))).toBe(false);
  });

  it('brings any box that fits onto the surface', () => {
    const random = seeded(2);
    for (let i = 0; i < 500; i++) {
      const candidate = box({
        x: random() * 1.4 - 0.2,
        y: random() * 1.4 - 0.2,
        width: 0.02 + random() * 0.23,
        height: 0.02 + random() * 0.23,
        rotation: random() * 60 - 30,
      });
      const clamped = clampInside(candidate);
      expect(isInside(clamped)).toBe(true);
      expect(clamped.width).toBe(candidate.width);
      expect(clamped.rotation).toBe(candidate.rotation);
    }
  });
});

describe('checkGeometry', () => {
  it('accepts a valid box', () => {
    expect(checkGeometry(box())).toBeNull();
  });

  it('refuses a box that is too small, too large or turned too far', () => {
    expect(checkGeometry(box({ width: MIN_BOX_WIDTH / 2 }))).toBe('size');
    expect(checkGeometry(box({ height: MIN_BOX_HEIGHT / 2 }))).toBe('size');
    expect(checkGeometry(box({ width: 1.01, height: 0.02 }))).toBe('size');
    expect(checkGeometry(box({ rotation: 30.01 }))).toBe('size');
    expect(checkGeometry(box({ rotation: -30.01 }))).toBe('size');
  });

  it('allows the full turn', () => {
    expect(checkGeometry(box({ width: 0.1, height: 0.1, rotation: 30 }))).toBeNull();
    expect(checkGeometry(box({ width: 0.1, height: 0.1, rotation: -30 }))).toBeNull();
  });

  it('allows exactly the area limit and nothing more', () => {
    expect(MAX_BOX_AREA).toBe(1 / 16);
    expect(checkGeometry(box({ width: 0.25, height: 0.25 }))).toBeNull();
    expect(checkGeometry(box({ width: 0.25, height: 0.2501 }))).toBe('area');
  });

  it('refuses a box too narrow for the longest word', () => {
    expect(checkGeometry(box(), [], 'a'.repeat(60))).toBe('small');
  });

  it('refuses a box with too little area for the text', () => {
    expect(checkGeometry(box({ width: 0.1, height: 0.03 }), [], 'ab '.repeat(33))).toBe('small');
    expect(checkGeometry(box({ width: 0.1, height: 0.03 }), [], 'ab')).toBeNull();
  });

  it('refuses a box off the surface', () => {
    expect(checkGeometry(box({ x: 0.05 }))).toBe('bounds');
  });

  it('refuses a box on top of another', () => {
    expect(checkGeometry(box(), [box({ x: 0.55 })])).toBe('overlap');
    expect(checkGeometry(box(), [box({ x: 0.1, width: 0.05 })])).toBeNull();
  });
});

describe('parseGeometry', () => {
  it('refuses anything but an object', () => {
    expect(parseGeometry(null)).toEqual({ ok: false, message: '"geometry" must be an object.' });
    expect(parseGeometry([])).toEqual({ ok: false, message: '"geometry" must be an object.' });
    expect(parseGeometry('box')).toEqual({ ok: false, message: '"geometry" must be an object.' });
  });

  it('refuses missing or invalid numbers', () => {
    const { rotation: _, ...missing } = box();
    expect(parseGeometry(missing)).toEqual({ ok: false, message: '"geometry.rotation" must be a number.' });
    expect(parseGeometry(box({ x: NaN }))).toMatchObject({ ok: false });
    expect(parseGeometry(box({ y: Infinity }))).toMatchObject({ ok: false });
    expect(parseGeometry(box({ width: 1001 }))).toMatchObject({ ok: false });
    expect(parseGeometry({ ...box(), height: '0.2' })).toMatchObject({ ok: false });
  });

  it('rounds to 4 decimals', () => {
    expect(parseGeometry(box({ x: 0.123456, rotation: 4.99996 }))).toEqual({
      ok: true,
      data: box({ x: 0.1235, rotation: 5 }),
    });
  });
});

describe('textLimits', () => {
  it('needs enough width for the longest word', () => {
    expect(textLimits('hi')?.minWidth).toBe(MIN_BOX_WIDTH);
    expect(textLimits('aaaaaaaaaa bb')?.minWidth).toBeCloseTo(0.045);
  });

  it('is null for text that can never fit', () => {
    expect(textLimits('a'.repeat(300))).toBeNull();
  });
});

describe('limitArea and clampSize', () => {
  it('keeps the proportions when scaling down', () => {
    const limited = limitArea(0.5, 0.25);
    expect(limited.width * limited.height).toBeCloseTo(MAX_BOX_AREA_EDITOR);
    expect(limited.width / limited.height).toBeCloseTo(2);
    expect(limitArea(0.1, 0.1)).toEqual({ width: 0.1, height: 0.1 });
  });

  it('always returns a size within the minimums and the area limit', () => {
    const sides = [0.001, 0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1, 2];
    for (const width of sides) {
      for (const height of sides) {
        const size = clampSize(width, height);
        expect(size.width).toBeGreaterThanOrEqual(MIN_BOX_WIDTH);
        expect(size.height).toBeGreaterThanOrEqual(MIN_BOX_HEIGHT);
        expect(size.width).toBeLessThanOrEqual(1);
        expect(size.height).toBeLessThanOrEqual(1);
        expect(size.width * size.height).toBeLessThanOrEqual(MAX_BOX_AREA_EDITOR + 1e-12);
      }
    }
  });
});

describe('findFreeSpot', () => {
  it('puts the first message in the middle of an empty card', () => {
    const spot = findFreeSpot([], undefined, undefined, 'Happy birthday!');
    expect(spot).not.toBeNull();
    expect(spot).toMatchObject({ x: 0.5, y: 0.5, rotation: 0 });
    expect(checkGeometry(spot!, [], 'Happy birthday!')).toBeNull();
  });

  it('avoids the messages already there', () => {
    const others = [box()];
    const spot = findFreeSpot(others, undefined, undefined, 'Congratulations');
    expect(spot).not.toBeNull();
    expect(checkGeometry(spot!, others, 'Congratulations')).toBeNull();
  });

  it('picks the free spot closest to `near` and keeps its turn', () => {
    const near = box({ x: 0.2, y: 0.3, width: 0.1, height: 0.07, rotation: 10 });
    const spot = findFreeSpot([box()], { width: 0.1, height: 0.07 }, near, 'Hi');
    expect(spot).not.toBeNull();
    expect(spot!.rotation).toBe(10);
    expect(Math.abs(spot!.x - near.x)).toBeLessThan(0.011);
    expect(Math.abs(spot!.y - near.y)).toBeLessThan(0.011);
  });

  it('returns null when the card is full', () => {
    expect(findFreeSpot(fullCard(), undefined, undefined, 'Hi')).toBeNull();
    expect(findFreeSpot(fullCard())).toBeNull();
  });

  it('never places a box that breaks the rules, however full the card gets', () => {
    const random = seeded(3);
    const words = ['Happy', 'birthday', 'love', 'from', 'all', 'of', 'us', 'congratulations', 'cheers'];
    const placed: Geometry[] = [];
    for (let i = 0; i < 25; i++) {
      const text = Array.from({ length: 1 + Math.floor(random() * 6) }, () => words[Math.floor(random() * words.length)]).join(' ');
      const near = random() < 0.5 ? box({ x: random(), y: random(), rotation: random() * 60 - 30 }) : undefined;
      const spot = findFreeSpot(placed, undefined, near, text);
      if (!spot) break;
      expect(checkGeometry(spot, placed, text)).toBeNull();
      placed.push(spot);
    }
    expect(placed.length).toBeGreaterThan(5);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        expect(boxesOverlap(placed[i], placed[j])).toBe(false);
      }
    }
  });
});

describe('hasRoomForMinimumBox', () => {
  it('is true on an empty card and false on a full one', () => {
    expect(hasRoomForMinimumBox([])).toBe(true);
    expect(hasRoomForMinimumBox(fullCard())).toBe(false);
  });

  it('is false for text that can never fit', () => {
    expect(hasRoomForMinimumBox([], 'a'.repeat(300))).toBe(false);
  });
});
