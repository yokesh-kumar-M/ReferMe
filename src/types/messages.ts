// Type-safe messaging between content script, popup, dashboard, and
// background service worker. All cross-context messages MUST conform to
// one of these shapes — the bridge in `src/extension/messaging.ts` is
// the only thing that should call chrome.runtime / postMessage directly.

import type { JobContext, UserProfile } from "./domain";

// ──────────────────────────────────────────────────────────────────────
// Messages sent FROM content script
// ──────────────────────────────────────────────────────────────────────

export type FromContent =
  | { type: "content/job-detected"; job: JobContext }
  | { type: "content/unknown-fields"; fields: UnknownField[] }
  | { type: "content/autofill-result"; filled: number; total: number }
  | { type: "content/ready"; url: string };

export interface UnknownField {
  id: string;
  label: string;
  inputType: "text" | "textarea" | "select" | "radio" | "checkbox";
  options?: string[];
}

// ──────────────────────────────────────────────────────────────────────
// Messages sent TO content script (from popup / dashboard / background)
// ──────────────────────────────────────────────────────────────────────

export type ToContent =
  | { type: "content/extract-job" }
  | { type: "content/autofill"; profile: UserProfile; coverLetter?: string }
  | { type: "content/fill-custom-answers"; answers: Record<string, string> }
  | { type: "content/toggle-panel"; open?: boolean }
  | { type: "content/ping" };

// ──────────────────────────────────────────────────────────────────────
// Background ↔ surfaces
// ──────────────────────────────────────────────────────────────────────

export type ToBackground =
  | { type: "bg/get-active-job" }
  | { type: "bg/relay-to-tab"; tabId?: number; message: ToContent };

export type FromBackground =
  | { type: "bg/active-job"; job: JobContext | null; tabId: number | null }
  | { type: "bg/ack" };

// ──────────────────────────────────────────────────────────────────────
// Union of every possible message — useful for switch exhaustiveness
// ──────────────────────────────────────────────────────────────────────

export type ExtensionMessage =
  | FromContent
  | ToContent
  | ToBackground
  | FromBackground;
