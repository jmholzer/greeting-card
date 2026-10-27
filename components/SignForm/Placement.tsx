'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import styles from './placement.module.css';

import MessageBox, { boxStyle } from '@/components/Card/MessageBox';
import { footprintOf, useFontsVersion, whenFontReady } from '@/components/Card/textFit';
import { fontFamilyMap } from '@/app/fonts';
import {
  clampInside,
  MAX_BOX_AREA_EDITOR,
  MAX_ROTATION,
  MIN_BOX_HEIGHT,
  MIN_BOX_WIDTH,
  textLimits,
} from '@/lib/geometry';
import { GEOMETRY_MESSAGES } from '@/lib/geometry';
import type { Geometry, GeometryProblem } from '@/lib/geometry';
import { usePlacementDrag } from '@/components/SignForm/usePlacementDrag';
import type { Message } from '@/utils/messages';

const BLOCKED_NOTICE = 'That spot is taken by another message.';
const BLOCKED_NOTICES: Partial<Record<GeometryProblem, string>> = {
  small: GEOMETRY_MESSAGES.small,
  overlap: BLOCKED_NOTICE,
};
const HELP =
  'Drag your message where you want it. Turn it with the round handle and resize it with the square one. You can also use the sliders, or select the message and use the arrow keys. Hold Shift for bigger steps.';
const NOTICE_MS = 2500;

interface PlacementProps {
  /** The messages already on the card. A new box may not overlap them. */
  others: Message[];
  text: string;
  fontFamily: string;
  box: Geometry;
  onChange: (box: Geometry) => void;
  disabled?: boolean;
  /** Shown in place of the instructions, for example when the spot had to change. */
  notice?: string;
  /** Buttons shown next to the preview, below it on a portrait screen. */
  actions: ReactNode;
  /** Filled in with a function that returns the footprint to save, measured once the font is ready. */
  measureRef: MutableRefObject<(() => Promise<Geometry>) | null>;
}

/**
 * Live preview of the card with the message being placed. It is dragged to move, turned
 * with the round handle and resized with the square one. A move that would leave the card
 * or touch another message is not made, so the box is always in a spot the server accepts.
 */
export default function Placement({
  others,
  text,
  fontFamily,
  box,
  onChange,
  disabled = false,
  notice = '',
  actions,
  measureRef,
}: PlacementProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLDivElement>(null);
  const [blocked, setBlocked] = useState('');
  const fontClass = fontFamilyMap[fontFamily] ?? '';
  const fontsVersion = useFontsVersion();

  const surfaceSize = useCallback(() => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    return { width: rect?.width ?? 0, height: rect?.height ?? 0 };
  }, []);

  const footprint = useCallback(
    (candidate: Geometry) => {
      const size = surfaceSize();
      return size.width > 0 && size.height > 0 ? footprintOf(candidate, text, fontClass, size) : candidate;
    },
    [surfaceSize, text, fontClass],
  );

  useEffect(() => {
    measureRef.current = async () => {
      await whenFontReady(text, fontClass);
      return footprint(box);
    };
    return () => {
      measureRef.current = null;
    };
  }, [measureRef, text, fontClass, footprint, box]);

  const [surface, setSurface] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const element = surfaceRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setSurface(surfaceSize()));
    observer.observe(element);
    return () => observer.disconnect();
  }, [surfaceSize]);
  const shownFootprint = useMemo(
    () => (surface?.width && surface.height ? footprintOf(box, text, fontClass, surface) : null),
    // fontsVersion is not read, but a loaded font changes the footprint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [surface, box, text, fontClass, fontsVersion],
  );

  const { apply, onKeyDown, move, rotate, resize } = usePlacementDrag({
    surface: surfaceRef,
    focusTarget: draftRef,
    box,
    text,
    footprint,
    obstacles: others.map((message) => message.box),
    disabled,
    onChange,
    onBlocked: (problem) => setBlocked(BLOCKED_NOTICES[problem] ?? BLOCKED_NOTICE),
  });

  useEffect(() => {
    if (!blocked) return;
    const timer = setTimeout(() => setBlocked(''), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [blocked]);

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
        onChange={(event) => apply(set(box, Number(event.target.value)))}
      />
      <output htmlFor={id} className={styles.sliderValue}>
        {Math.round(value)}
        {unit === 'degrees' ? '\u00b0' : '%'}
      </output>
    </div>
  );

  // Width and height are limits, not one fixed shape: a wider box may be shorter, as long as
  // the area still holds the text. Widening gives way on the height, and the other way round.
  const limits = textLimits(text) ?? {
    minWidth: MIN_BOX_WIDTH,
    minHeight: MIN_BOX_HEIGHT,
    minArea: MIN_BOX_WIDTH * MIN_BOX_HEIGHT,
  };
  const maxWidthPercent = Math.min(100, Math.floor((MAX_BOX_AREA_EDITOR / limits.minHeight) * 100));
  const maxHeightPercent = Math.min(100, Math.floor((MAX_BOX_AREA_EDITOR / limits.minWidth) * 100));
  const minWidthPercent = Math.min(maxWidthPercent, Math.ceil(Math.max(limits.minWidth, limits.minArea / box.height) * 100));
  const minHeightPercent = Math.min(maxHeightPercent, Math.ceil(Math.max(limits.minHeight, limits.minArea / box.width) * 100));

  return (
    <div className={styles.layout}>
      <div className={styles.card}>
        <div className={styles.surface} ref={surfaceRef}>
          {others.map((message) => (
            <MessageBox
              key={message.id}
              text={message.text}
              fontFamily={message.fontFamily}
              box={message.box}
              messageId={message.id}
            />
          ))}
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
          >
            <span
              className={`${styles.handle} ${styles.rotateHandle}`}
              aria-hidden
              {...rotate}
            />
            <span
              className={`${styles.handle} ${styles.resizeHandle}`}
              aria-hidden
              {...resize}
            />
          </MessageBox>
          {shownFootprint && (
            <div className={styles.footprint} style={boxStyle(shownFootprint)} aria-hidden />
          )}
        </div>
      </div>

      <div className={styles.side}>
        <p id="placement-help" className={styles.srOnly}>
          {HELP}
        </p>
        <p className={styles.help} aria-live="polite">
          {blocked || notice}
        </p>

        <div className={styles.fineTune}>
          {slider('place-x', 'Left to right', box.x * 100, 0, 100, 'percent from the left', (b, v) =>
            clampInside({ ...b, x: v / 100 }),
          )}
          {slider('place-y', 'Top to bottom', box.y * 100, 0, 100, 'percent from the top', (b, v) =>
            clampInside({ ...b, y: v / 100 }),
          )}
          {slider('place-rotation', 'Turn', box.rotation, -MAX_ROTATION, MAX_ROTATION, 'degrees', (b, v) =>
            clampInside({ ...b, rotation: v }),
          )}
          {slider(
            'place-width',
            'Width',
            box.width * 100,
            minWidthPercent,
            maxWidthPercent,
            'percent of the card width',
            (b, v) => {
              const width = Math.min(Math.max(v / 100, limits.minWidth), MAX_BOX_AREA_EDITOR / limits.minHeight);
              const height = Math.min(
                Math.max(b.height, limits.minHeight, limits.minArea / width),
                MAX_BOX_AREA_EDITOR / width,
              );
              return clampInside({ ...b, width, height });
            },
          )}
          {slider(
            'place-height',
            'Height',
            box.height * 100,
            minHeightPercent,
            maxHeightPercent,
            'percent of the card height',
            (b, v) => {
              const height = Math.min(Math.max(v / 100, limits.minHeight), MAX_BOX_AREA_EDITOR / limits.minWidth);
              const width = Math.min(
                Math.max(b.width, limits.minWidth, limits.minArea / height),
                MAX_BOX_AREA_EDITOR / height,
              );
              return clampInside({ ...b, width, height });
            },
          )}
        </div>

        {actions}
      </div>
    </div>
  );
}
