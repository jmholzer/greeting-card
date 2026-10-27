import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, RefObject } from 'react';

import {
  checkGeometry,
  clampInside,
  clampSize,
  MAX_ROTATION,
  roundGeometry,
} from '@/lib/geometry';
import type { Geometry, GeometryProblem } from '@/lib/geometry';

const KEY_STEP = 0.01;
const KEY_STEP_LARGE = 0.05;

type Kind = 'move' | 'rotate' | 'resize';

type Drag = {
  kind: Kind;
  pointerId: number;
  startX: number;
  startY: number;
  start: Geometry;
};

interface Options {
  /** The writing surface, whose size turns pointer movement into fractions of the card. */
  surface: RefObject<HTMLElement | null>;
  /** Gets focus when a drag starts, so the arrow keys work right after. */
  focusTarget: RefObject<HTMLElement | null>;
  box: Geometry;
  /** The message, which decides how small its footprint may be. */
  text: string;
  /** The tight footprint (text plus padding) of a box drawn here. That is what may not touch other messages. */
  footprint: (box: Geometry) => Geometry;
  /** Footprints of the messages already on the card. */
  obstacles: Geometry[];
  disabled: boolean;
  onChange: (box: Geometry) => void;
  /** A change was refused, with the rule it would have broken. */
  onBlocked: (problem: GeometryProblem) => void;
}

const toDegrees = (radians: number) => (radians * 180) / Math.PI;

/**
 * Drag, rotate, resize and arrow key handling for the message being placed. A change is
 * only made when the result is a spot the server would accept, so the box never rests
 * somewhere invalid. Rotation is limited to plus or minus 30 degrees and size to the
 * area limit and a legible minimum.
 */
export function usePlacementDrag(options: Options) {
  const optionsRef = useRef(options);
  const boxRef = useRef(options.box);
  const dragRef = useRef<Drag | null>(null);
  // True from pointer down until the gesture ends. Auto-grow waits, so a drag is not resized mid-move.
  const dragging = useRef(false);
  const stopListen = useRef<(() => void) | null>(null);
  const [gestureTick, setGestureTick] = useState(0);

  useEffect(() => {
    optionsRef.current = options;
    boxRef.current = options.box;
  });

  /** Applies the first candidate that is a valid spot. Returns whether one was. */
  const apply = useCallback((...candidates: Geometry[]): boolean => {
    const { obstacles, footprint, text, onChange, onBlocked } = optionsRef.current;
    let problem: GeometryProblem | null = null;
    for (const candidate of candidates) {
      const rounded = roundGeometry(candidate);
      problem =
        checkGeometry(rounded) ?? checkGeometry(footprint(rounded), obstacles, text);
      if (problem === null) {
        boxRef.current = rounded;
        onChange(rounded);
        return true;
      }
    }
    if (problem) onBlocked(problem);
    return false;
  }, []);

  const endDrag = useCallback((pointerId: number) => {
    if (dragRef.current?.pointerId !== pointerId) return;
    stopListen.current?.();
    stopListen.current = null;
    dragRef.current = null;
    dragging.current = false;
    setGestureTick((tick) => tick + 1);
  }, []);

  const startGesture = useCallback((kind: Kind, pointerId: number, x: number, y: number, focus: boolean) => {
    if (optionsRef.current.disabled) return;
    stopListen.current?.();
    dragRef.current = { kind, pointerId, startX: x, startY: y, start: boxRef.current };
    dragging.current = true;
    // Capture can fail for a drag that starts in the text field. pointerup then lands on
    // whatever is under the cursor, so listen on the window and always clear the drag.
    const finish = (event: Event) => {
      if ((event as globalThis.PointerEvent).pointerId !== pointerId) return;
      endDrag(pointerId);
    };
    window.addEventListener('pointerup', finish, true);
    window.addEventListener('pointercancel', finish, true);
    stopListen.current = () => {
      window.removeEventListener('pointerup', finish, true);
      window.removeEventListener('pointercancel', finish, true);
    };
    if (focus) optionsRef.current.focusTarget.current?.focus({ preventScroll: true });
  }, [endDrag]);

  const begin = useCallback((kind: Kind, event: PointerEvent<HTMLElement>) => {
    if (optionsRef.current.disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    startGesture(kind, event.pointerId, event.clientX, event.clientY, true);
  }, [startGesture]);

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      const rect = optionsRef.current.surface.current?.getBoundingClientRect();
      if (!drag || drag.pointerId !== event.pointerId || !rect) return;
      event.preventDefault();
      const current = boxRef.current;

      if (drag.kind === 'move') {
        const moved = clampInside({
          ...drag.start,
          x: drag.start.x + (event.clientX - drag.startX) / rect.width,
          y: drag.start.y + (event.clientY - drag.startY) / rect.height,
        });
        // When the full move is blocked, slide along one axis so the box can run along a neighbour.
        apply(moved, { ...moved, y: current.y }, { ...moved, x: current.x });
      } else if (drag.kind === 'rotate') {
        const centerX = rect.left + current.x * rect.width;
        const centerY = rect.top + current.y * rect.height;
        const angle = toDegrees(Math.atan2(event.clientY - centerY, event.clientX - centerX)) + 90;
        const wrapped = ((((angle + 180) % 360) + 360) % 360) - 180;
        const target = Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, wrapped));
        // Stop at a neighbour instead of refusing the whole turn: try halfway, then a quarter of the way.
        const steps = [target, (current.rotation + target) / 2, (3 * current.rotation + target) / 4];
        apply(...steps.map((rotation) => clampInside({ ...current, rotation })));
      } else {
        const radians = (drag.start.rotation * Math.PI) / 180;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        // The pointer's movement along the box's own sides. The centre stays put, so each side grows by twice that.
        const along = dx * Math.cos(radians) + dy * Math.sin(radians);
        const across = -dx * Math.sin(radians) + dy * Math.cos(radians);
        const size = clampSize(
          drag.start.width + (2 * along) / rect.width,
          drag.start.height + (2 * across) / rect.height,
        );
        apply(
          clampInside({ ...current, ...size }),
          clampInside({ ...current, width: size.width }),
          clampInside({ ...current, height: size.height }),
        );
      }
    },
    [apply],
  );

  const onPointerEnd = useCallback((event: PointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) endDrag(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [endDrag]);

  useEffect(() => () => {
    stopListen.current?.();
    dragging.current = false;
  }, []);

  const downMove = useCallback((event: PointerEvent<HTMLElement>) => begin('move', event), [begin]);
  const downRotate = useCallback((event: PointerEvent<HTMLElement>) => begin('rotate', event), [begin]);
  const downResize = useCallback((event: PointerEvent<HTMLElement>) => begin('resize', event), [begin]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (optionsRef.current.disabled || !event.key.startsWith('Arrow')) return;
      // Arrow keys inside the text box move the caret. They move the box only when the box itself is selected.
      if (event.target !== event.currentTarget) return;
      event.preventDefault();
      const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
      const current = boxRef.current;
      const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
      const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
      apply(clampInside({ ...current, x: current.x + dx, y: current.y + dy }));
    },
    [apply],
  );

  const shared = { onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd };
  return {
    apply,
    startGesture,
    onPointerMove,
    onPointerEnd,
    onKeyDown,
    move: { ...shared, onPointerDown: downMove },
    rotate: { ...shared, onPointerDown: downRotate },
    resize: { ...shared, onPointerDown: downResize },
    dragging,
    gestureTick,
  };
}
