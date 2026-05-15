// Triggers an autofill on the active tab. Works from both the toolbar
// popup window and the side-panel iframe — the messaging bridge picks
// the right channel.

import { sendToActiveTab } from "@/extension/messaging";
import type { UserProfile, ToContent } from "@/types";

export interface AutofillResult {
  filled: number;
  total: number;
}

export async function runAutofill(
  profile: UserProfile,
  coverLetter?: string
): Promise<AutofillResult> {
  const msg: ToContent = {
    type: "content/autofill",
    profile,
    coverLetter,
  };
  const reply = await sendToActiveTab<{ filled?: number; total?: number }>(msg);
  return { filled: reply?.filled ?? 0, total: reply?.total ?? 0 };
}

export async function sendCustomAnswers(
  answers: Record<string, string>
): Promise<AutofillResult> {
  const msg: ToContent = {
    type: "content/fill-custom-answers",
    answers,
  };
  const reply = await sendToActiveTab<{ filled?: number; total?: number }>(msg);
  return { filled: reply?.filled ?? 0, total: reply?.total ?? 0 };
}
