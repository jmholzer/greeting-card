import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { useMotionValue, useSpring } from 'framer-motion';

const MAX_TILT_DEGREES = 6;
const MOVE_THRESHOLD_PX = 8;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

type PermissionedOrientationEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

/**
 * Subtle tilt (in degrees) driven by the device orientation sensors.
 *
 * Does nothing where the sensors are unavailable (desktop) or when disabled.
 * On iOS the sensors need a permission that can only be requested from a user
 * gesture, so call `requestPermission` from a tap or swipe handler. A refusal
 * or an error leaves the tilt switched off.
 */
export function useDeviceTilt(enabled: boolean) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const tiltX = useSpring(rawX, { stiffness: 120, damping: 20 });
  const tiltY = useSpring(rawY, { stiffness: 120, damping: 20 });
  const listening = useRef(false);
  const decided = useRef(false);
  const asking = useRef(false);

  const onOrientation = useCallback(
    (event: DeviceOrientationEvent) => {
      // Desktop browsers may fire one event with null readings.
      if (event.beta == null || event.gamma == null) return;
      rawX.set(clamp(-(event.beta - 50) * 0.15, -MAX_TILT_DEGREES, MAX_TILT_DEGREES));
      rawY.set(clamp(event.gamma * 0.15, -MAX_TILT_DEGREES, MAX_TILT_DEGREES));
    },
    [rawX, rawY],
  );

  const stop = useCallback(() => {
    window.removeEventListener('deviceorientation', onOrientation);
    listening.current = false;
    rawX.set(0);
    rawY.set(0);
  }, [onOrientation, rawX, rawY]);

  const start = useCallback(() => {
    if (listening.current) return;
    window.addEventListener('deviceorientation', onOrientation);
    listening.current = true;
  }, [onOrientation]);

  useEffect(() => {
    if (!enabled) return;
    const Orientation = window.DeviceOrientationEvent as PermissionedOrientationEvent | undefined;
    if (!Orientation) return;
    // Browsers without the permission API (Android, desktop) need no prompt.
    if (typeof Orientation.requestPermission !== 'function') start();
    return stop;
  }, [enabled, start, stop]);

  const requestPermission = useCallback(async () => {
    if (!enabled || decided.current || asking.current) return;
    const Orientation = window.DeviceOrientationEvent as PermissionedOrientationEvent | undefined;
    if (!Orientation || typeof Orientation.requestPermission !== 'function') return;

    asking.current = true;
    try {
      const result = await Orientation.requestPermission();
      decided.current = true;
      if (result === 'granted') start();
    } catch {
      // Not called from a user gesture or not allowed: stay off, retry on the next gesture.
    } finally {
      asking.current = false;
    }
  }, [enabled, start]);

  return { tiltX, tiltY, requestPermission };
}

interface GestureOptions {
  /** `point` is the click position; it is missing for keyboard activation. */
  onTap: (point?: { x: number; y: number }) => void;
  onMove?: (dx: number, dy: number) => void;
  onEnd?: (dx: number, dy: number, vx: number, vy: number) => void;
  onKey?: (key: string) => boolean;
}

/**
 * One handler set for mouse, touch, pen and keyboard: a tap/click (or
 * Enter/Space) calls `onTap`, a drag reports `onMove` and then `onEnd` with
 * the final offset and velocity (px/s).
 */
export function useGesture(options: GestureOptions) {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const start = useRef<{ id: number; x: number; y: number; time: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
      moved: false,
    };
    suppressClick.current = false;
  }, []);

  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const s = start.current;
    if (!s || s.id !== event.pointerId) return;
    const dx = event.clientX - s.x;
    const dy = event.clientY - s.y;
    if (!s.moved && Math.hypot(dx, dy) > MOVE_THRESHOLD_PX) s.moved = true;
    if (s.moved) optionsRef.current.onMove?.(dx, dy);
  }, []);

  const finish = useCallback((event: PointerEvent<HTMLElement>, cancelled: boolean) => {
    const s = start.current;
    if (!s || s.id !== event.pointerId) return;
    start.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!s.moved) return;

    suppressClick.current = true;
    const dx = event.clientX - s.x;
    const dy = event.clientY - s.y;
    const seconds = Math.max(1, performance.now() - s.time) / 1000;
    optionsRef.current.onEnd?.(
      cancelled ? 0 : dx,
      cancelled ? 0 : dy,
      cancelled ? 0 : dx / seconds,
      cancelled ? 0 : dy / seconds,
    );
  }, []);

  const onPointerUp = useCallback((event: PointerEvent<HTMLElement>) => finish(event, false), [finish]);
  const onPointerCancel = useCallback((event: PointerEvent<HTMLElement>) => finish(event, true), [finish]);

  const onClick = useCallback((event: MouseEvent<HTMLElement>) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    optionsRef.current.onTap({ x: event.clientX, y: event.clientY });
  }, []);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    // Holding a key must not run several steps of the flow in one go.
    if (event.repeat) {
      if (event.key === 'Enter' || event.key === ' ' || event.key.startsWith('Arrow')) {
        event.preventDefault();
      }
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      optionsRef.current.onTap();
    } else if (optionsRef.current.onKey?.(event.key)) {
      event.preventDefault();
    }
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClick, onKeyDown };
}
