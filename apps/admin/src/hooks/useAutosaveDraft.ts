import { useEffect, useRef } from "react";

export interface StoredDraft<T> {
  savedAt: number;
  data: T;
}

// Periodically persists a snapshot of an in-progress form to localStorage —
// a real power outage or browser crash before the next manual Save just
// evaporates React state, but a synchronous localStorage write already on
// disk survives it. Not a replacement for actually saving (no server round
// trip, doesn't survive clearing browser data, doesn't sync across
// devices) — just insurance against losing typed work between saves.
export function useAutosaveDraft<T>(key: string, getSnapshot: () => T, intervalMs = 4000) {
  const getSnapshotRef = useRef(getSnapshot);
  getSnapshotRef.current = getSnapshot;

  useEffect(() => {
    const id = setInterval(() => {
      const draft: StoredDraft<T> = { savedAt: Date.now(), data: getSnapshotRef.current() };
      try {
        localStorage.setItem(key, JSON.stringify(draft));
      } catch {
        // Storage full or unavailable (private browsing) — autosave is a
        // nice-to-have on top of the real Save button, not a hard requirement.
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [key, intervalMs]);
}

export function loadDraft<T>(key: string): StoredDraft<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as StoredDraft<T>;
  } catch {
    return null;
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
