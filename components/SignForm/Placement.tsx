'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import styles from './placement.module.css';

import MessageBox from '@/components/Card/MessageBox';
import {
  clampInside,
  MAX_BOX_AREA_EDITOR,
  MAX_ROTATION,
  MIN_BOX_HEIGHT,
  MIN_BOX_WIDTH,
} from '@/lib/geometry';
import type { Geometry } from '@/lib/geometry';
import { usePlacementDrag } from '@/components/SignForm/usePlacementDrag';
import type { Message } from '@/utils/messages';

const BLOCKED_NOTICE = 'That spot is taken by another message.';
const HELP =
  'Drag your message where you want it. Turn it with the round handle and resize it with the square one.';
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
}: PlacementProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLDivElement>(null);
  const [blocked, setBlocked] = useState('');

  const { apply, onKeyDown, move, rotate, resize } = usePlacementDrag({
    surface: surfaceRef,
    focusTarget: draftRef,
    box,
    obstacles: others.map((message) => message.box),
    disabled,
    onChange,
    onBlocked: () => setBlocked(BLOCKED_NOTICE),
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

  const maxWidthPercent = Math.floor((MAX_BOX_AREA_EDITOR / MIN_BOX_HEIGHT) * 100);
  const maxHeightPercent = Math.floor((MAX_BOX_AREA_EDITOR / MIN_BOX_WIDTH) * 100);

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
        </div>
      </div>

      <div className={styles.side}>
        <p id="placement-help" className={styles.help} aria-live="polite">
          {blocked || notice || HELP}
        </p>

        <details className={styles.fineTune}>
          <summary>Adjust with sliders or the arrow keys</summary>
          <p className={styles.fineTuneHint}>
            Or select the message on the card and use the arrow keys. Hold Shift for bigger steps.
          </p>
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
            Math.ceil(MIN_BOX_WIDTH * 100),
            maxWidthPercent,
            'percent of the card width',
            (b, v) => clampInside({ ...b, width: Math.min(v / 100, MAX_BOX_AREA_EDITOR / b.height) }),
          )}
          {slider(
            'place-height',
            'Height',
            box.height * 100,
            Math.ceil(MIN_BOX_HEIGHT * 100),
            maxHeightPercent,
            'percent of the card height',
            (b, v) => clampInside({ ...b, height: Math.min(v / 100, MAX_BOX_AREA_EDITOR / b.width) }),
          )}
        </details>

        {actions}
      </div>
    </div>
  );
}
