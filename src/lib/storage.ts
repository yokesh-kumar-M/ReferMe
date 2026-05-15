// Unified storage adapter. Returns a zustand-compatible StateStorage that
// uses chrome.storage.local when running inside the extension (popup,
// side-panel iframe, content script, dashboard opened via chrome-extension://)
// and falls back to window.localStorage on the public website.
//
// Why this matters:
// - chrome.storage.local is the ONLY storage shared across every extension
//   surface (popup, content script, service worker, dashboard tab). Plain
//   localStorage is partitioned per-origin and not visible from the service
//   worker at all.
// - Using one adapter means the same zustand store code works in every
//   context with zero conditionals at the call site.

import type { StateStorage } from "zustand/middleware";

function hasChromeStorage(): boolean {
  return (
    typeof chrome !== "undefined" &&
    typeof chrome.storage !== "undefined" &&
    typeof chrome.storage.local !== "undefined"
  );
}

function chromeStorage(): StateStorage {
  return {
    getItem: (name) =>
      new Promise<string | null>((resolve) => {
        chrome.storage.local.get([name], (result) => {
          const v = result[name];
          resolve(typeof v === "string" ? v : v == null ? null : JSON.stringify(v));
        });
      }),
    setItem: (name, value) =>
      new Promise<void>((resolve) => {
        chrome.storage.local.set({ [name]: value }, () => resolve());
      }),
    removeItem: (name) =>
      new Promise<void>((resolve) => {
        chrome.storage.local.remove([name], () => resolve());
      }),
  };
}

function webStorage(): StateStorage {
  return {
    getItem: (name) => {
      try {
        return window.localStorage.getItem(name);
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        window.localStorage.setItem(name, value);
      } catch {
        // Quota exceeded or storage disabled — silently drop. State stays
        // in memory for the session.
      }
    },
    removeItem: (name) => {
      try {
        window.localStorage.removeItem(name);
      } catch {
        /* noop */
      }
    },
  };
}

// SSR-safe noop storage. During server render / static export, no window
// or chrome global exists. Returning a noop keeps zustand happy until
// the client takes over and re-reads from the real storage on hydration.
function noopStorage(): StateStorage {
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

export function getRuntimeStorage(): StateStorage {
  if (typeof window === "undefined") return noopStorage();
  if (hasChromeStorage()) return chromeStorage();
  return webStorage();
}

// Convenience for use with `createJSONStorage(() => unifiedStorage)`
export const unifiedStorage = (): StateStorage => getRuntimeStorage();

// ──────────────────────────────────────────────────────────────────────
// Direct (non-zustand) helpers for one-off reads/writes — e.g. content
// script needs to read keys without mounting a full store.
// ──────────────────────────────────────────────────────────────────────

export async function readKey<T = unknown>(name: string): Promise<T | null> {
  const raw = await Promise.resolve(getRuntimeStorage().getItem(name));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

export async function writeKey(name: string, value: unknown): Promise<void> {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  await Promise.resolve(getRuntimeStorage().setItem(name, serialized));
}
