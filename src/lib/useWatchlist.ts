"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Local-only watchlist backed by localStorage, read through
 * useSyncExternalStore so it is hydration-safe and reacts across tabs
 * (toggling on a stock page updates an open watchlist page live).
 */

const KEY = "steadyticker:watchlist";
const EMPTY: readonly string[] = [];

let cache: readonly string[] = EMPTY;
let cacheRaw: string | null = null;

function read(): readonly string[] {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cache;
  }
  if (raw === cacheRaw) return cache; // stable reference between reads
  cacheRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cacheRaw = null; // force re-parse
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function write(next: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — ignore */
  }
  cacheRaw = null;
  listeners.forEach((l) => l()); // storage event doesn't fire in the same tab
}

export function useWatchlist() {
  const list = useSyncExternalStore(
    subscribe,
    read,
    () => EMPTY,
  );

  const toggle = useCallback((ticker: string) => {
    const cur = read();
    write(
      cur.includes(ticker)
        ? cur.filter((t) => t !== ticker)
        : [...cur, ticker],
    );
  }, []);

  return { list, toggle };
}
