"use client";

import { useSyncExternalStore } from "react";

// React 19 lints `useEffect(() => setMounted(true))` as a cascading
// render. useSyncExternalStore returns `true` after the client subscribes
// without triggering an extra render in the React 19 sense.
//
// Usage: `const mounted = useMounted(); if (!mounted) return null;`
// SSR returns false (server snapshot); first client tick returns true.

function subscribe() {
  // We never re-emit — `getSnapshot` will return true once we're on the
  // client and React will use that immediately on hydration.
  return () => {};
}

const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
