import { useSyncExternalStore } from 'react';

import styles from './fitText.module.css';

import { FOOTPRINT_PADDING, MIN_BOX_HEIGHT, MIN_BOX_WIDTH } from '@/lib/geometry';
import type { Geometry } from '@/lib/geometry';

// The text is never made smaller than this, so a tiny box cannot make the search fail.
const MIN_FONT_PX = 0.1;
const SEARCH_PRECISION_PX = 0.02;
const FIT_TOLERANCE_PX = 0.01;
const DECIMALS = 10000;

export interface TextFit {
  /** The largest font size, in px, at which the text fits the box. */
  fontSize: number;
  /** Line height, as a multiple of the font size, chosen so no glyph pokes out of its line. */
  lineHeight: number;
  /** Space kept left and right of the lines, in em, for glyphs that overhang. */
  sidePadding: number;
  /** Width of the widest line with its side padding, in px. */
  width: number;
  /** Height of all the lines, in px. */
  height: number;
}

interface InkMetrics {
  lineHeight: number;
  sidePadding: number;
}

const FALLBACK_INK: InkMetrics = { lineHeight: 1.3, sidePadding: 0.15 };
const MIN_LINE_HEIGHT = 1.1;
const MAX_LINE_HEIGHT = 2.2;
const CANVAS_SIZE = 100;
const INK_MARGIN_EM = 0.02;

const cache = new Map<string, TextFit>();
const inkCache = new Map<string, InkMetrics>();
const CACHE_LIMIT = 600;

// Fonts that finish loading change the width of text, so everything measured before is stale.
let fontsVersion = 0;
const listeners = new Set<() => void>();

if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.addEventListener('loadingdone', () => {
    fontsVersion++;
    cache.clear();
    inkCache.clear();
    listeners.forEach((notify) => notify());
  });
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

/** Changes whenever a font finishes loading, so a component using measurements can redo them. */
export function useFontsVersion(): number {
  return useSyncExternalStore(
    subscribe,
    () => fontsVersion,
    () => 0,
  );
}

let measurer: HTMLDivElement | null = null;

function getMeasurer(): HTMLDivElement {
  if (measurer?.isConnected) return measurer;
  measurer = document.createElement('div');
  measurer.setAttribute('aria-hidden', 'true');
  Object.assign(measurer.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
  });
  document.body.appendChild(measurer);
  return measurer;
}

let canvas: CanvasRenderingContext2D | null = null;

/**
 * How far the glyphs of this text reach beyond their line box, from the font's own outlines.
 * Script fonts swash above, below and to the sides of the box the browser lays out, so the
 * line height and the side padding are set from the glyphs actually used. Both the visible
 * text and the stored footprint use them, so the ink always stays inside the footprint.
 */
function inkMetrics(text: string, family: string, key: string): InkMetrics {
  const known = inkCache.get(key);
  if (known) return known;
  canvas ??= document.createElement('canvas').getContext('2d');
  let result = FALLBACK_INK;
  if (canvas) {
    canvas.font = `${CANVAS_SIZE}px ${family}`;
    let ascent = 0;
    let descent = 0;
    let left = 0;
    let right = 0;
    let fontAscent: number | undefined;
    let fontDescent: number | undefined;
    for (const char of new Set(text.replace(/\s/g, ''))) {
      const m = canvas.measureText(char);
      fontAscent = m.fontBoundingBoxAscent;
      fontDescent = m.fontBoundingBoxDescent;
      ascent = Math.max(ascent, m.actualBoundingBoxAscent);
      descent = Math.max(descent, m.actualBoundingBoxDescent);
      left = Math.max(left, m.actualBoundingBoxLeft);
      right = Math.max(right, m.actualBoundingBoxRight - m.width);
    }
    if (fontAscent !== undefined && fontDescent !== undefined) {
      // The line box is centred on the font's own ascent and descent, so measure from that centre.
      const shift = (fontDescent - fontAscent) / 2;
      const half = Math.max(ascent + shift, descent - shift);
      result = {
        lineHeight: Math.min(
          MAX_LINE_HEIGHT,
          Math.max(MIN_LINE_HEIGHT, (2 * half) / CANVAS_SIZE + INK_MARGIN_EM),
        ),
        sidePadding: Math.max(left, right, 0) / CANVAS_SIZE + INK_MARGIN_EM,
      };
    }
  }
  inkCache.set(key, result);
  return result;
}

/**
 * Finds the largest font size at which the text fits a box of this size (in px), and the
 * tight size of the text at that size. The visible text and the stored footprint both
 * come from this one function, so they cannot drift apart.
 */
export function fitText(text: string, fontClass: string, width: number, height: number): TextFit {
  const key = `${fontClass}|${width.toFixed(2)}|${height.toFixed(2)}|${text}`;
  const known = cache.get(key);
  if (known) return known;

  const el = getMeasurer();
  el.className = `${fontClass} ${styles.fit}`;
  el.textContent = text;
  el.style.width = `${Math.max(width, 0)}px`;
  const ink = inkMetrics(text, getComputedStyle(el).fontFamily, `${fontClass}|${text}`);
  el.style.lineHeight = String(ink.lineHeight);
  el.style.paddingInline = `${ink.sidePadding}em`;

  const fits = (size: number) => {
    el.style.fontSize = `${size}px`;
    return (
      el.getBoundingClientRect().height <= height + FIT_TOLERANCE_PX &&
      el.scrollWidth <= Math.ceil(width)
    );
  };

  let low = MIN_FONT_PX;
  let high = Math.max(height, MIN_FONT_PX);
  if (fits(high)) {
    low = high;
  } else if (fits(low)) {
    while (high - low > SEARCH_PRECISION_PX) {
      const middle = (low + high) / 2;
      if (fits(middle)) low = middle;
      else high = middle;
    }
  }
  el.style.fontSize = `${low}px`;

  const range = document.createRange();
  range.selectNodeContents(el);
  let left = Infinity;
  let right = -Infinity;
  for (const rect of range.getClientRects()) {
    if (rect.width === 0) continue;
    left = Math.min(left, rect.left);
    right = Math.max(right, rect.right);
  }
  const widest = Number.isFinite(left) ? right - left : width;
  const result: TextFit = {
    fontSize: low,
    lineHeight: ink.lineHeight,
    sidePadding: ink.sidePadding,
    width: Math.min(widest + 2 * ink.sidePadding * low, width),
    height: Math.min(el.getBoundingClientRect().height, height),
  };

  el.textContent = '';
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, result);
  return result;
}

/** The padding kept around the text on every side, in px, for a surface this high. */
export function paddingPx(surfaceHeight: number): number {
  return FOOTPRINT_PADDING * surfaceHeight;
}

export interface SurfaceSize {
  width: number;
  height: number;
}

const roundUp = (value: number) => Math.ceil(value * DECIMALS - 1e-6) / DECIMALS;

/**
 * The footprint of a message drawn in `box`: the tight bounds of its text, plus the padding.
 * It has the same centre and turn as the box, and is never larger than it. Showing
 * this footprint's text gives the same picture as showing the drawn box's text.
 */
export function footprintOf(
  box: Geometry,
  text: string,
  fontClass: string,
  surface: SurfaceSize,
): Geometry {
  const pad = paddingPx(surface.height);
  const contentWidth = box.width * surface.width - 2 * pad;
  const contentHeight = box.height * surface.height - 2 * pad;
  if (contentWidth <= 0 || contentHeight <= 0) return box;

  const fit = fitText(text, fontClass, contentWidth, contentHeight);
  // A little extra width keeps the same line breaks on a screen whose font metrics differ slightly.
  const slack = Math.max(0.75, fit.fontSize * 0.02);
  const width = roundUp((Math.min(fit.width + slack, contentWidth) + 2 * pad) / surface.width);
  const height = roundUp((fit.height + 2 * pad) / surface.height);
  return {
    ...box,
    width: Math.min(box.width, Math.max(MIN_BOX_WIDTH, width)),
    height: Math.min(box.height, Math.max(MIN_BOX_HEIGHT, height)),
  };
}

/** Resolves when the fonts the text needs are ready, so a measurement taken after it can be trusted. */
export async function whenFontReady(text: string, fontClass: string): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  fitText(text, fontClass, 100, 20);
  await document.fonts.ready;
}
