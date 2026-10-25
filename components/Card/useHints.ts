import { useCallback, useMemo, useSyncExternalStore } from 'react';

export type HintStep = 'openEnvelope' | 'takeOut' | 'openCard';

const STORAGE_KEY = 'greeting-card:hints-done';

// Used when localStorage is missing or throws (private mode, blocked storage),
// so hints still disappear for the rest of the visit.
let memory: string[] = [];
const listeners = new Set<() => void>();

function readSnapshot(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? JSON.stringify(memory);
  } catch {
    return JSON.stringify(memory);
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function parse(snapshot: string): string[] {
  try {
    const value: unknown = JSON.parse(snapshot);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Tracks which steps of the card flow the visitor has already done, so each
 * hint is shown only until its action has been performed once. Progress is
 * kept in localStorage. `ready` is false on the server and during hydration,
 * so no hint is rendered until the saved progress is known.
 */
export function useHints() {
  const snapshot = useSyncExternalStore<string | null>(subscribe, readSnapshot, () => null);
  const ready = snapshot !== null;
  const done = useMemo(() => (snapshot === null ? [] : parse(snapshot)), [snapshot]);

  const isDone = useCallback((step: HintStep) => done.includes(step), [done]);

  const markDone = useCallback((step: HintStep) => {
    const current = parse(readSnapshot());
    if (current.includes(step)) return;
    const next = [...current, step];
    memory = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable: keep the in-memory copy only.
    }
    listeners.forEach((listener) => listener());
  }, []);

  return { ready, isDone, markDone };
}
