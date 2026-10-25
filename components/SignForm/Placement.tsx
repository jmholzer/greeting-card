'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MutableRefObject, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { flushSync } from 'react-dom';
import styles from './placement.module.css';

import MessageBox, { boxStyle } from '@/components/Card/MessageBox';
import { footprintOf, useFontsVersion, whenFontReady } from '@/components/Card/textFit';
import { fontFamilyMap } from '@/app/fonts';
import { MAX_MESSAGE_LENGTH, MAX_MESSAGE_LINES } from '@/lib/config';
import {
  checkGeometry,
  clampInside,
  clampSize,
  defaultSize,
  findFreeSpot,
  GEOMETRY_MESSAGES,
  MAX_BOX_AREA_EDITOR,
  MAX_ROTATION,
  MIN_BOX_HEIGHT,
  MIN_BOX_WIDTH,
  roundGeometry,
  textLimits,
} from '@/lib/geometry';
import type { Geometry, GeometryProblem, TextLimits } from '@/lib/geometry';
import { sanitizeText } from '@/lib/validation';
import { usePlacementDrag } from '@/components/SignForm/usePlacementDrag';
import type { Message } from '@/utils/messages';

const BLOCKED_NOTICE = 'That spot is taken by another message.';
const LINE_NOTICE = `Use at most ${MAX_MESSAGE_LINES} lines.`;
const BLOCKED_NOTICES: Partial<Record<GeometryProblem, string>> = {
  small: GEOMETRY_MESSAGES.small,
  overlap: BLOCKED_NOTICE,
};
const HELP =
  'Tap an empty part of the card to start writing, or drag to draw a box. Then type. Drag the box to move it, turn it with the round handle and resize it with the square one. You can also use the sliders, or select the box and use the arrow keys. Hold Shift for bigger steps.';
const NOTICE_MS = 2500;
const DRAW_THRESHOLD = 8;
const PLACEHOLDER = 'Your message';
const FALLBACK_BOX: Geometry = { x: 0.5, y: 0.5, width: 0.2, height: 0.16, rotation: 0 };

interface PlacementProps {
  /** The messages already on the card. A new box may not overlap them. */
  others: Message[];
  text: string;
  onTextChange: (text: string) => void;
  fontFamily: string;
  /** Null until the signer taps the card or drags out a box. */
  box: Geometry | null;
  onChange: (box: Geometry) => void;
  /** Put the caret in the text when the box is already there, such as when editing. */
  focusOnMount?: boolean;
  disabled?: boolean;
  /** Shown when the spot had to change, or a move was refused. */
  notice?: string;
  /** Called when the card has no free spot left for a box. */
  onNoRoom?: () => void;
  /** Buttons shown next to the preview, below it on a portrait screen. */
  actions: ReactNode;
  /** Filled in with a function that returns the footprint to save, measured once the font is ready. */
  measureRef: MutableRefObject<(() => Promise<Geometry>) | null>;
}

interface SurfaceGesture {
  pointerId: number;
  originX: number;
  originY: number;
  anchorX: number;
  anchorY: number;
  mode: 'draw' | 'relocate';
  last: Geometry | null;
}

function changed(a: Geometry, b: Geometry): boolean {
  return (['x', 'y', 'width', 'height', 'rotation'] as const).some((key) => Math.abs(a[key] - b[key]) > 5e-5);
}

/** A larger box in the same place, grown towards the size this text needs. Null when it cannot grow. */
function enlarge(box: Geometry, limits: TextLimits): Geometry | null {
  const width = Math.min(1, Math.max(box.width * 1.15, limits.minWidth));
  const height = Math.min(1, Math.max(box.height * 1.15, limits.minHeight, limits.minArea / width));
  const sized = clampSize(width, height);
  let next = clampInside({
    ...box,
    width: Math.max(sized.width, Math.min(width, limits.minWidth)),
    height: Math.max(sized.height, limits.minHeight),
  });
  if (next.width + 1e-6 < limits.minWidth || next.width * next.height + 1e-6 < limits.minArea) {
    const fittedWidth = Math.min(1, Math.max(limits.minWidth, next.width));
    const fittedHeight = Math.min(
      MAX_BOX_AREA_EDITOR / fittedWidth,
      Math.max(limits.minHeight, limits.minArea / fittedWidth, next.height),
    );
    next = clampInside({ ...box, width: fittedWidth, height: fittedHeight });
  }
  return changed(next, box) ? next : null;
}

/** Keeps at most four lines and the character limit. Extra lines are reported so the form can say so. */
function limitText(previous: string, value: string): { text: string; extraLine: boolean } {
  const normalized = value.replace(/\r\n?/g, '\n').slice(0, MAX_MESSAGE_LENGTH);
  const lines = normalized.split('\n');
  if (lines.length <= MAX_MESSAGE_LINES) return { text: normalized, extraLine: false };
  const kept = lines.slice(0, MAX_MESSAGE_LINES).join('\n');
  const prev = previous.replace(/\r\n?/g, '\n');
  // A new break in a full message must not throw away the lines already written.
  if (prev.split('\n').length >= MAX_MESSAGE_LINES && !kept.startsWith(prev)) {
    return { text: prev, extraLine: true };
  }
  return { text: kept, extraLine: true };
}

const KEYBOARD_SLACK = 140;

function visibleHeight(): number {
  return window.visualViewport?.height ?? window.innerHeight;
}

/**
 * Blur runs before the tap that left the field becomes a click, while the keyboard is still open.
 * Keep the large card until that click has landed and the keyboard has closed.
 * Returns a function that cancels the wait.
 */
function holdLargeCard(baseline: number, field: HTMLTextAreaElement | null, onRelease: () => void): () => void {
  let settled = false;
  let watching = false;
  let wait = 0;
  let giveUp = 0;
  let onClick: (() => void) | null = null;
  const viewport = window.visualViewport;
  const keyboardOpen = () => baseline > 0 && visibleHeight() < baseline - KEYBOARD_SLACK;

  const clearWatch = () => {
    if (!watching) return;
    watching = false;
    viewport?.removeEventListener('resize', settle);
    window.removeEventListener('resize', settle);
  };

  const clearClick = () => {
    if (!onClick) return;
    window.removeEventListener('click', onClick);
    onClick = null;
  };

  const finish = (release: boolean) => {
    if (settled) return;
    settled = true;
    window.clearTimeout(wait);
    window.clearTimeout(giveUp);
    window.removeEventListener('pointerup', afterPointer);
    window.removeEventListener('pointercancel', afterPointer);
    clearClick();
    clearWatch();
    if (release) onRelease();
  };

  const settle = () => {
    if (settled) return;
    // Focused again. The focus handler keeps the large size.
    if (field && document.activeElement === field) {
      finish(false);
      return;
    }
    if (keyboardOpen()) {
      if (watching) return;
      watching = true;
      viewport?.addEventListener('resize', settle);
      window.addEventListener('resize', settle);
      return;
    }
    finish(true);
  };

  // The click that left the field follows pointerup, sometimes after a short delay. Let it land first.
  const afterPointer = () => {
    window.clearTimeout(wait);
    clearClick();
    onClick = () => {
      clearClick();
      settle();
    };
    window.addEventListener('click', onClick);
    wait = window.setTimeout(settle, 500);
  };

  window.addEventListener('pointerup', afterPointer);
  window.addEventListener('pointercancel', afterPointer);
  // A keyboard blur (Tab) has no pointer. A missed resize must not leave the card large forever.
  wait = window.setTimeout(settle, 500);
  giveUp = window.setTimeout(() => finish(true), 4000);

  return () => finish(false);
}

/**
 * The card, with a box the signer places by tapping or dragging and then types into.
 * The box can be moved, turned and resized before or after typing. A change that would
 * leave the card or touch another message is not made.
 */
export default function Placement({
  others,
  text,
  onTextChange,
  fontFamily,
  box,
  onChange,
  focusOnMount = false,
  disabled = false,
  notice = '',
  onNoRoom,
  actions,
  measureRef,
}: PlacementProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const didMountFocus = useRef(false);
  const growWarned = useRef('');
  const gestureRef = useRef<SurfaceGesture | null>(null);
  const textGesture = useRef<{ pointerId: number; x: number; y: number; drag: boolean } | null>(null);
  const [blocked, setBlocked] = useState('');
  const [lineTick, setLineTick] = useState(0);
  const [preview, setPreview] = useState<Geometry | null>(null);
  const [writing, setWriting] = useState(false);
  // The visible height before the keyboard opened. Compared after blur to see if it is still up.
  const openHeight = useRef(0);
  const cancelHold = useRef<(() => void) | null>(null);
  const fontClass = fontFamilyMap[fontFamily] ?? '';
  const fontsVersion = useFontsVersion();
  const obstacles = useMemo(() => others.map((message) => message.box), [others]);

  const surfaceSize = useCallback(() => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    return { width: rect?.width ?? 0, height: rect?.height ?? 0 };
  }, []);

  const footprint = useCallback(
    (candidate: Geometry) => {
      const cleaned = sanitizeText(text);
      // With no text yet, the whole drawn box is the footprint, which is the stricter check.
      if (!cleaned) return candidate;
      const size = surfaceSize();
      return size.width > 0 && size.height > 0 ? footprintOf(candidate, cleaned, fontClass, size) : candidate;
    },
    [surfaceSize, text, fontClass],
  );

  const fitBox = useCallback(
    (start: Geometry, sample: string): { box: Geometry; problem: GeometryProblem | null } => {
      const cleaned = sanitizeText(sample);
      const limits = cleaned ? textLimits(cleaned) : null;
      if (cleaned && !limits) return { box: start, problem: 'small' };
      let next = start;
      for (let attempt = 0; attempt < 8; attempt++) {
        const print = footprint(next);
        const problem = checkGeometry(next) ?? checkGeometry(print, obstacles, cleaned);
        if (!problem) return { box: roundGeometry(next), problem: null };
        if (problem !== 'small' || !limits) return { box: next, problem };
        const bigger = enlarge(next, limits);
        if (!bigger) return { box: next, problem };
        next = bigger;
      }
      return { box: next, problem: 'small' };
    },
    [footprint, obstacles],
  );

  const boxRef = useRef(box);
  useEffect(() => {
    boxRef.current = box;
  });

  useEffect(() => {
    measureRef.current = async () => {
      const current = boxRef.current ?? FALLBACK_BOX;
      const cleaned = sanitizeText(text);
      await whenFontReady(cleaned, fontClass);
      const fitted = fitBox(current, text);
      if (!fitted.problem && changed(fitted.box, current)) onChange(fitted.box);
      const chosen = fitted.problem ? current : fitted.box;
      const size = surfaceSize();
      if (!cleaned || size.width <= 0 || size.height <= 0) return chosen;
      return footprintOf(chosen, cleaned, fontClass, size);
    };
    return () => {
      measureRef.current = null;
    };
  }, [measureRef, text, fontClass, surfaceSize, fitBox, onChange]);

  const [surface, setSurface] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const element = surfaceRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setSurface(surfaceSize()));
    observer.observe(element);
    return () => observer.disconnect();
  }, [surfaceSize]);

  const shownFootprint = useMemo(() => {
    if (!box || !surface?.width || !surface.height || !sanitizeText(text)) return null;
    return footprintOf(box, sanitizeText(text), fontClass, surface);
    // fontsVersion is not read, but a loaded font changes the footprint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface, box, text, fontClass, fontsVersion]);

  const { apply, startGesture, onPointerMove, onPointerEnd, onKeyDown, move, rotate, resize } = usePlacementDrag({
    surface: surfaceRef,
    focusTarget: draftRef,
    box: box ?? FALLBACK_BOX,
    text: sanitizeText(text),
    footprint,
    obstacles,
    disabled,
    onChange,
    onBlocked: (problem) => setBlocked(BLOCKED_NOTICES[problem] ?? BLOCKED_NOTICE),
  });

  const finishPointer = (event: ReactPointerEvent<HTMLElement>) => {
    textGesture.current = null;
    onPointerEnd(event);
  };

  // Moving the box does not change whether the text fits, so this follows the size only.
  const boxSizeKey = box ? `${box.width.toFixed(4)}x${box.height.toFixed(4)}` : '';
  useEffect(() => {
    const current = boxRef.current;
    if (!current || disabled) return;
    const cleaned = sanitizeText(text);
    if (!cleaned) {
      growWarned.current = '';
      return;
    }
    let cancelled = false;
    void (async () => {
      // Wait for the real font, or a fallback measurement would grow a box that already fits.
      await whenFontReady(cleaned, fontClass);
      if (cancelled || surfaceSize().width <= 0) return;
      const latest = boxRef.current;
      if (!latest) return;
      const fitted = fitBox(latest, text);
      if (cancelled) return;
      if (!fitted.problem) {
        growWarned.current = '';
        if (changed(fitted.box, latest)) onChange(fitted.box);
        return;
      }
      const key = `${fitted.problem}:${cleaned}`;
      if (growWarned.current === key) return;
      growWarned.current = key;
      setBlocked(BLOCKED_NOTICES[fitted.problem] ?? BLOCKED_NOTICE);
    })();
    return () => {
      cancelled = true;
    };
  }, [boxSizeKey, text, disabled, fitBox, onChange, fontsVersion, fontClass, surfaceSize, surface]);

  useEffect(() => {
    if (!blocked) return;
    const timer = setTimeout(() => setBlocked(''), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [blocked]);

  useEffect(() => {
    if (!lineTick) return;
    const timer = setTimeout(() => setLineTick(0), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [lineTick]);

  // Focus while the box is already on screen, such as when editing. A phone waits for a tap, so the keyboard does not open on its own.
  useLayoutEffect(() => {
    if (!focusOnMount || didMountFocus.current || !box) return;
    if (window.matchMedia('(pointer: coarse)').matches) {
      didMountFocus.current = true;
      return;
    }
    const field = inputRef.current;
    if (!field) return;
    didMountFocus.current = true;
    field.focus({ preventScroll: true });
    const end = field.value.length;
    field.setSelectionRange(end, end);
  }, [focusOnMount, box]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const onResize = () => {
      const field = inputRef.current;
      if (document.activeElement === field) {
        field?.scrollIntoView({ block: 'center', inline: 'nearest' });
        return;
      }
      openHeight.current = Math.max(openHeight.current, visibleHeight());
    };
    onResize();
    viewport?.addEventListener('resize', onResize);
    window.addEventListener('resize', onResize);
    return () => {
      viewport?.removeEventListener('resize', onResize);
      window.removeEventListener('resize', onResize);
      cancelHold.current?.();
      cancelHold.current = null;
    };
  }, []);

  const onEditorFocus = () => {
    cancelHold.current?.();
    cancelHold.current = null;
    openHeight.current = Math.max(openHeight.current, visibleHeight());
    setWriting(true);
  };

  const onEditorBlur = () => {
    cancelHold.current?.();
    const field = inputRef.current;
    cancelHold.current = holdLargeCard(openHeight.current, field, () => {
      cancelHold.current = null;
      setWriting(false);
    });
  };

  const clientToFraction = (clientX: number, clientY: number) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
  };

  const placeAt = (x: number, y: number) => {
    const cleaned = sanitizeText(text);
    const base = defaultSize(Math.max(cleaned.length, 18));
    const limits = cleaned ? textLimits(cleaned) : null;
    let width = base.width;
    let height = base.height;
    if (limits) {
      width = Math.max(width, limits.minWidth);
      height = Math.max(height, limits.minHeight, limits.minArea / width);
      const sized = clampSize(width, height);
      width = sized.width;
      height = Math.max(sized.height, limits.minHeight, limits.minArea / Math.max(width, MIN_BOX_WIDTH));
    }
    const start = clampInside({ x, y, width, height, rotation: 0 });
    const commit = (chosen: Geometry) => {
      // Focus in this gesture, after the field is on the page, so a phone can open the keyboard.
      flushSync(() => {
        onChange(chosen);
      });
      inputRef.current?.focus();
      // A small nudge onto the card is part of placing. Only say so when the box moved to a different spot.
      if (Math.hypot((chosen.x - x) * 1.41, chosen.y - y) > 0.2) setBlocked(BLOCKED_NOTICE);
    };
    let fitted = fitBox(start, text);
    if (!fitted.problem) {
      commit(fitted.box);
      return;
    }
    const spot = findFreeSpot(obstacles, { width, height }, start, cleaned || undefined);
    if (spot) {
      fitted = fitBox(spot, text);
      if (!fitted.problem) {
        commit(fitted.box);
        return;
      }
    }
    if (onNoRoom) onNoRoom();
    else setBlocked(BLOCKED_NOTICES[fitted.problem ?? 'overlap'] ?? BLOCKED_NOTICE);
  };

  const onSurfacePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (event.target instanceof Element && event.target.closest('[data-message-id]')) return;
    const point = clientToFraction(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    surfaceRef.current?.setPointerCapture(event.pointerId);
    gestureRef.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      anchorX: point.x,
      anchorY: point.y,
      mode: box ? 'relocate' : 'draw',
      last: null,
    };
  };

  const onSurfacePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || gesture.mode !== 'draw') return;
    if (Math.hypot(event.clientX - gesture.originX, event.clientY - gesture.originY) < DRAW_THRESHOLD) return;
    const point = clientToFraction(event.clientX, event.clientY);
    if (!point) return;
    const left = Math.min(gesture.anchorX, point.x);
    const right = Math.max(gesture.anchorX, point.x);
    const top = Math.min(gesture.anchorY, point.y);
    const bottom = Math.max(gesture.anchorY, point.y);
    const size = clampSize(right - left, bottom - top);
    const drawn = roundGeometry(
      clampInside({
        x: (left + right) / 2,
        y: (top + bottom) / 2,
        width: size.width,
        height: size.height,
        rotation: 0,
      }),
    );
    const problem = checkGeometry(drawn) ?? checkGeometry(footprint(drawn), obstacles, sanitizeText(text));
    if (!problem) {
      gesture.last = drawn;
      setPreview(drawn);
    }
  };

  const onSurfacePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    setPreview(null);
    if (surfaceRef.current?.hasPointerCapture(event.pointerId)) {
      surfaceRef.current.releasePointerCapture(event.pointerId);
    }
    const moved = Math.hypot(event.clientX - gesture.originX, event.clientY - gesture.originY) >= DRAW_THRESHOLD;
    if (gesture.mode === 'relocate') {
      if (moved || !box) return;
      apply(clampInside({ ...box, x: gesture.anchorX, y: gesture.anchorY }));
      return;
    }
    if (!moved) {
      placeAt(gesture.anchorX, gesture.anchorY);
      return;
    }
    if (gesture.last) {
      const fitted = fitBox(gesture.last, text);
      if (!fitted.problem) {
        flushSync(() => {
          onChange(fitted.box);
        });
        inputRef.current?.focus();
        return;
      }
    }
    setBlocked(BLOCKED_NOTICE);
  };

  const onSurfaceKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (box || disabled) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const cleaned = sanitizeText(text);
    const size = defaultSize(Math.max(cleaned.length, 18));
    const spot = findFreeSpot(obstacles, size, undefined, cleaned || undefined);
    if (!spot) {
      if (onNoRoom) onNoRoom();
      else setBlocked(BLOCKED_NOTICE);
      return;
    }
    const fitted = fitBox(spot, text);
    if (fitted.problem) {
      if (onNoRoom) onNoRoom();
      else setBlocked(BLOCKED_NOTICES[fitted.problem] ?? BLOCKED_NOTICE);
      return;
    }
    flushSync(() => {
      onChange(fitted.box);
    });
    inputRef.current?.focus();
  };

  const onEditorPointerDown = (event: ReactPointerEvent<HTMLTextAreaElement>) => {
    if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.stopPropagation();
    textGesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, drag: false };
  };

  const onEditorPointerMove = (event: ReactPointerEvent<HTMLTextAreaElement>) => {
    const gesture = textGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (!gesture.drag) {
      if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < DRAW_THRESHOLD) return;
      gesture.drag = true;
      startGesture('move', event.pointerId, gesture.x, gesture.y, false);
      try {
        draftRef.current?.setPointerCapture(event.pointerId);
      } catch {
        // Follow the pointer from this field when the box cannot capture it.
      }
    }
    onPointerMove(event);
  };

  const onEditorChange = (value: string) => {
    const limited = limitText(text, value);
    if (limited.extraLine) setLineTick((tick) => tick + 1);
    onTextChange(limited.text);
  };

  const slider = (
    id: string,
    label: string,
    value: number,
    min: number,
    max: number,
    unit: string,
    set: (current: Geometry, value: number) => Geometry,
  ) => (
    <div className={styles.sliderRow}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={Math.round(Math.max(min, Math.min(max, value)))}
        disabled={disabled}
        aria-valuetext={`${Math.round(value)} ${unit}`}
        onKeyDown={(event) => {
          // Enter on a slider must not send the message.
          if (event.key === 'Enter') event.preventDefault();
        }}
        onChange={(event) => {
          if (!box) return;
          apply(set(box, Number(event.target.value)));
        }}
      />
      <output htmlFor={id} className={styles.sliderValue}>
        {Math.round(value)}
        {unit === 'degrees' ? '\u00b0' : '%'}
      </output>
    </div>
  );

  const limits = textLimits(sanitizeText(text)) ?? {
    minWidth: MIN_BOX_WIDTH,
    minHeight: MIN_BOX_HEIGHT,
    minArea: MIN_BOX_WIDTH * MIN_BOX_HEIGHT,
  };
  const maxWidthPercent = Math.min(100, Math.floor((MAX_BOX_AREA_EDITOR / limits.minHeight) * 100));
  const maxHeightPercent = Math.min(100, Math.floor((MAX_BOX_AREA_EDITOR / limits.minWidth) * 100));
  const minWidthPercent = box
    ? Math.min(maxWidthPercent, Math.ceil(Math.max(limits.minWidth, limits.minArea / box.height) * 100))
    : 0;
  const minHeightPercent = box
    ? Math.min(maxHeightPercent, Math.ceil(Math.max(limits.minHeight, limits.minArea / box.width) * 100))
    : 0;
  const status = blocked || notice || (lineTick > 0 ? LINE_NOTICE : '');
  const pointerEnd = { onPointerUp: finishPointer, onPointerCancel: finishPointer };

  return (
    <div className={`${styles.layout} ${writing ? styles.writing : ''}`}>
      <div className={styles.card}>
        <div
          className={`${styles.surface} ${box ? '' : styles.surfaceEmpty}`}
          ref={surfaceRef}
          data-sign-surface
          tabIndex={box || disabled ? -1 : 0}
          role={box ? undefined : 'button'}
          aria-label={box ? undefined : 'Choose a spot for your message'}
          aria-describedby="placement-help"
          onKeyDown={onSurfaceKeyDown}
          onPointerDown={onSurfacePointerDown}
          onPointerMove={onSurfacePointerMove}
          onPointerUp={onSurfacePointerEnd}
          onPointerCancel={onSurfacePointerEnd}
        >
          {others.map((message) => (
            <MessageBox
              key={message.id}
              text={message.text}
              fontFamily={message.fontFamily}
              box={message.box}
              messageId={message.id}
            />
          ))}
          {box && (
            <MessageBox
              ref={draftRef}
              text={text}
              fontFamily={fontFamily}
              box={box}
              className={`${styles.draft} ${disabled ? styles.draftDisabled : ''}`}
              tabIndex={disabled ? -1 : 0}
              role="group"
              aria-label="Your message on the card"
              aria-describedby="placement-help"
              onKeyDown={onKeyDown}
              {...move}
              {...pointerEnd}
              editorRef={inputRef}
              editor={{
                value: text,
                placeholder: PLACEHOLDER,
                maxLength: MAX_MESSAGE_LENGTH,
                disabled,
                onChange: onEditorChange,
                onPointerDown: onEditorPointerDown,
                onPointerMove: onEditorPointerMove,
                onPointerUp: finishPointer,
                onPointerCancel: finishPointer,
                onFocus: onEditorFocus,
                onBlur: onEditorBlur,
              }}
            >
              <span className={`${styles.handle} ${styles.rotateHandle}`} aria-hidden {...rotate} {...pointerEnd} />
              <span className={`${styles.handle} ${styles.resizeHandle}`} aria-hidden {...resize} {...pointerEnd} />
            </MessageBox>
          )}
          {shownFootprint && <div className={styles.footprint} style={boxStyle(shownFootprint)} aria-hidden />}
          {preview && <div className={styles.draw} style={boxStyle(preview)} aria-hidden />}
        </div>
      </div>

      <div className={styles.side}>
        <p id="placement-help" className={styles.srOnly}>
          {HELP}
        </p>
        <p className={styles.help} aria-live="polite">
          {status}
        </p>

        {box && (
          <div className={styles.fineTune}>
            {slider('place-x', 'Left to right', box.x * 100, 0, 100, 'percent from the left', (current, value) =>
              clampInside({ ...current, x: value / 100 }),
            )}
            {slider('place-y', 'Top to bottom', box.y * 100, 0, 100, 'percent from the top', (current, value) =>
              clampInside({ ...current, y: value / 100 }),
            )}
            {slider(
              'place-rotation',
              'Turn',
              box.rotation,
              -MAX_ROTATION,
              MAX_ROTATION,
              'degrees',
              (current, value) => clampInside({ ...current, rotation: value }),
            )}
            {slider(
              'place-width',
              'Width',
              box.width * 100,
              minWidthPercent,
              maxWidthPercent,
              'percent of the card width',
              (current, value) => {
                const width = Math.min(Math.max(value / 100, limits.minWidth), MAX_BOX_AREA_EDITOR / limits.minHeight);
                const height = Math.min(
                  Math.max(current.height, limits.minHeight, limits.minArea / width),
                  MAX_BOX_AREA_EDITOR / width,
                );
                return clampInside({ ...current, width, height });
              },
            )}
            {slider(
              'place-height',
              'Height',
              box.height * 100,
              minHeightPercent,
              maxHeightPercent,
              'percent of the card height',
              (current, value) => {
                const height = Math.min(
                  Math.max(value / 100, limits.minHeight),
                  MAX_BOX_AREA_EDITOR / limits.minWidth,
                );
                const width = Math.min(
                  Math.max(current.width, limits.minWidth, limits.minArea / height),
                  MAX_BOX_AREA_EDITOR / height,
                );
                return clampInside({ ...current, width, height });
              },
            )}
          </div>
        )}

        {actions}
      </div>
    </div>
  );
}
