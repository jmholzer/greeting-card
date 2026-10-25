import { useMemo, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'greeting-card:owned-messages';

// Used when localStorage is missing or throws (private mode, blocked storage),
// so a signer can still edit their message for the rest of the visit.
let memory: Record<string, string> = {};
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

function parse(snapshot: string): Record<string, string> {
  try {
    const value: unknown = JSON.parse(snapshot);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '',
      ),
    );
  } catch {
    return {};
  }
}

function write(next: Record<string, string>) {
  memory = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: keep the in-memory copy only.
  }
  listeners.forEach((listener) => listener());
}

/** Remembers the secret that lets this browser change one of its messages. */
export function saveOwnedMessage(id: number, token: string) {
  write({ ...parse(readSnapshot()), [id]: token });
}

export function forgetOwnedMessage(id: number) {
  const next = parse(readSnapshot());
  delete next[id];
  write(next);
}

/**
 * The messages this browser wrote, as `{ id: edit token }`. `ready` is false on the
 * server and during hydration, so nothing owner-only is rendered before the saved
 * tokens are known.
 */
export function useOwnedMessages() {
  const snapshot = useSyncExternalStore<string | null>(subscribe, readSnapshot, () => null);
  const tokens = useMemo(() => (snapshot === null ? {} : parse(snapshot)), [snapshot]);
  return { ready: snapshot !== null, tokens };
}
