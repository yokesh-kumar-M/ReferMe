// The ONLY module that should call chrome.runtime.sendMessage,
// chrome.tabs.sendMessage, or window.postMessage cross-context. Every
// other module talks via these typed helpers.
//
// Three contexts call into this:
//   1. Popup running in the toolbar popup window  → needs chrome.tabs.sendMessage
//      to reach the content script of the active tab.
//   2. Popup running as the side-panel iframe inside a job page → can use
//      window.parent.postMessage (same tab) OR chrome.tabs.sendMessage.
//   3. Content script → uses window.postMessage to its hosted iframe, and
//      chrome.runtime.sendMessage to reach the background / popup.
//
// The bug in the v1 popup was that it ALWAYS used window.parent.postMessage,
// which is a no-op when the popup is the toolbar window (parent === self).
// `sendToActiveTab` below resolves the correct target every time.

import type {
  FromBackground,
  FromContent,
  ToBackground,
  ToContent,
} from "@/types";

// ──────────────────────────────────────────────────────────────────────
// Runtime context detection
// ──────────────────────────────────────────────────────────────────────

export type ExtensionContext =
  | "toolbar-popup" // chrome-extension://… popup window opened from toolbar icon
  | "side-panel" // popup HTML mounted as iframe inside a job page
  | "dashboard" // dashboard tab (chrome-extension://… /dashboard)
  | "content-script" // page-injected content.js
  | "service-worker" // background.js
  | "web"; // no chrome extension at all — plain website

export function detectContext(): ExtensionContext {
  if (typeof window === "undefined") {
    // No window — service worker.
    return typeof chrome !== "undefined" && chrome.runtime?.id
      ? "service-worker"
      : "web";
  }
  const inExt = typeof chrome !== "undefined" && !!chrome.runtime?.id;
  if (!inExt) return "web";

  // Content script runs inside the page; chrome.runtime is available but
  // chrome.tabs is not. The simplest reliable detection: chrome.tabs is
  // defined in extension pages but not in content scripts.
  if (typeof chrome.tabs === "undefined") return "content-script";

  // Now we're in an extension page. URL tells us which one.
  const url = window.location?.href ?? "";
  if (url.includes("/dashboard")) return "dashboard";
  // The popup HTML can be embedded as an iframe — when that's the case
  // window has a parent that's NOT itself.
  if (window.parent !== window) return "side-panel";
  return "toolbar-popup";
}

// ──────────────────────────────────────────────────────────────────────
// Active-tab helpers (only meaningful from popup / dashboard contexts)
// ──────────────────────────────────────────────────────────────────────

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  if (typeof chrome === "undefined" || !chrome.tabs?.query) return null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab ?? null;
  } catch {
    return null;
  }
}

// Send a message to the content script of the active tab, regardless of
// whether we're in the toolbar popup, the side-panel iframe, or the
// dashboard. Returns the typed reply if the content script answers.
export async function sendToActiveTab<R = unknown>(
  message: ToContent
): Promise<R | null> {
  // Side panel: iframe inside the page → parent IS the content host.
  // postMessage is the lower-latency path.
  if (typeof window !== "undefined" && window.parent !== window) {
    try {
      window.parent.postMessage(message, "*");
    } catch {
      /* fall through to tab-based path */
    }
  }

  const tab = await getActiveTab();
  if (!tab?.id) return null;

  return new Promise<R | null>((resolve) => {
    try {
      chrome.tabs.sendMessage(tab.id!, message, (response: R) => {
        if (chrome.runtime.lastError) {
          // No content script in this tab (e.g. chrome:// URL). That's
          // a normal case; surface as null, not an error.
          resolve(null);
          return;
        }
        resolve(response ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

// ──────────────────────────────────────────────────────────────────────
// Runtime broadcast (popup ↔ background ↔ dashboard)
// ──────────────────────────────────────────────────────────────────────

export async function sendToBackground<R = FromBackground | null>(
  message: ToBackground
): Promise<R | null> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return null;
  return new Promise<R | null>((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response: R) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(response ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

// ──────────────────────────────────────────────────────────────────────
// Listeners
// ──────────────────────────────────────────────────────────────────────

export type MessageHandler = (
  msg: FromContent | ToContent | ToBackground | FromBackground,
  sender: chrome.runtime.MessageSender
) => void | boolean | Promise<unknown>;

export function onRuntimeMessage(handler: MessageHandler): () => void {
  if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) return () => {};
  const wrapper = (
    msg: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ): boolean => {
    const result = handler(msg as never, sender);
    if (result && typeof (result as Promise<unknown>).then === "function") {
      (result as Promise<unknown>).then(sendResponse).catch(() => sendResponse(null));
      return true; // keep channel open
    }
    if (result !== undefined) sendResponse(result);
    return false;
  };
  chrome.runtime.onMessage.addListener(wrapper);
  return () => chrome.runtime.onMessage.removeListener(wrapper);
}

export type WindowHandler = (
  msg: FromContent | ToContent
) => void;

export function onWindowMessage(handler: WindowHandler): () => void {
  if (typeof window === "undefined") return () => {};
  const wrapper = (event: MessageEvent) => {
    const data = event.data;
    if (!data || typeof data !== "object" || !data.type) return;
    handler(data as never);
  };
  window.addEventListener("message", wrapper);
  return () => window.removeEventListener("message", wrapper);
}
