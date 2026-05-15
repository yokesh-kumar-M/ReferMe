"use client";

// First-run wizard. Mounted at the dashboard root; shows itself only if
// the user has no API key configured yet. Three steps, fully skippable
// at the last screen — the user can also leave at any step and the
// progress is persisted.

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, KeyRound, FileText, Puzzle, ArrowRight, ArrowLeft, CheckCircle2, X, Upload, ExternalLink } from "lucide-react";

import { useKeysStore, hasAnyKey } from "@/store/keysStore";
import { useProfileStore } from "@/store/profileStore";
import { Button, Input, Textarea } from "@/components/ui";

type Step = 0 | 1 | 2 | 3;

const STORAGE_KEY = "referme/onboarded";

export function OnboardingWizard() {
  const keys = useKeysStore();
  const profile = useProfileStore();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const [resumeText, setResumeText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");

  useEffect(() => {
    if (!keys.hydrated || !profile.hydrated) return;
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(STORAGE_KEY) === "true";
    } catch (_) {}
    if (!dismissed && !hasAnyKey(keys)) setOpen(true);
  }, [keys, profile.hydrated]);

  useEffect(() => {
    const active = profile.getActiveResume();
    if (active?.content) setResumeText(active.content);
  }, [profile]);

  function dismiss() {
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } catch (_) {}
  }

  async function parsePdf(file: File) {
    setParsing(true);
    setParseError("");
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        text += tc.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
      }
      setResumeText(text.trim());
    } catch (e) {
      setParseError(
        e instanceof Error ? e.message : "Failed to parse PDF. Try pasting the text directly."
      );
    } finally {
      setParsing(false);
    }
  }

  function saveResume() {
    if (!resumeText.trim()) return;
    const active = profile.getActiveResume();
    if (active) profile.updateResume(active.id, { content: resumeText.trim() });
    else profile.addResume("Default Resume", resumeText.trim());
  }

  function go(next: Step) {
    if (next === 2 && resumeText.trim()) saveResume();
    setStep(next);
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0 }}
          className="relative bg-white rounded-3xl shadow-2xl border border-zinc-200 w-full max-w-2xl overflow-hidden"
        >
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 z-10 text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Steps indicator */}
          <div className="px-8 pt-8 pb-3">
            <div className="flex items-center gap-2 mb-6">
              {([0, 1, 2, 3] as Step[]).map((s) => (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div
                    className={
                      "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-colors " +
                      (s < step
                        ? "bg-emerald-500 text-white"
                        : s === step
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                        : "bg-zinc-100 text-zinc-400")
                    }
                  >
                    {s < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : s + 1}
                  </div>
                  {s < 3 && (
                    <div className={"h-0.5 flex-1 rounded " + (s < step ? "bg-emerald-300" : "bg-zinc-200")} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="px-8 pb-8">
            {step === 0 && <WelcomeStep onNext={() => go(1)} />}
            {step === 1 && (
              <KeyStep
                groq={keys.keys.groq}
                gemini={keys.keys.gemini}
                onGroq={(v) => keys.setKey("groq", v)}
                onGemini={(v) => keys.setKey("gemini", v)}
                onBack={() => go(0)}
                onNext={() => go(2)}
                canContinue={hasAnyKey(keys)}
              />
            )}
            {step === 2 && (
              <ResumeStep
                value={resumeText}
                onChange={setResumeText}
                onPdf={parsePdf}
                parsing={parsing}
                error={parseError}
                onBack={() => go(1)}
                onNext={() => go(3)}
              />
            )}
            {step === 3 && <InstallStep onFinish={dismiss} />}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center py-4">
      <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg">
        <Sparkles className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-2xl font-black text-zinc-900">Welcome to ReferMe</h2>
      <p className="text-sm text-zinc-500 mt-2 leading-relaxed max-w-md mx-auto">
        Your personal Jobright. Autofill applications, tailor resumes, draft outreach
        — all powered by your own free AI key. Three quick steps and you&apos;re live.
      </p>
      <div className="grid grid-cols-3 gap-3 mt-7 mb-6 text-left">
        {[
          { icon: KeyRound, label: "Add API key", desc: "Free Groq or Gemini" },
          { icon: FileText, label: "Add resume", desc: "Paste or upload PDF" },
          { icon: Puzzle, label: "Install extension", desc: "Optional but powerful" },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="rounded-xl bg-zinc-50 border border-zinc-100 p-3">
            <Icon className="w-4 h-4 text-indigo-500 mb-2" />
            <p className="text-xs font-bold text-zinc-800">{label}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">{desc}</p>
          </div>
        ))}
      </div>
      <Button variant="primary" size="lg" icon={<ArrowRight className="w-4 h-4" />} onClick={onNext}>
        Get started
      </Button>
    </div>
  );
}

function KeyStep({
  groq,
  gemini,
  onGroq,
  onGemini,
  onBack,
  onNext,
  canContinue,
}: {
  groq: string;
  gemini: string;
  onGroq: (v: string) => void;
  onGemini: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  canContinue: boolean;
}) {
  return (
    <div>
      <h2 className="text-xl font-black text-zinc-900 flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-indigo-500" /> Add an API key
      </h2>
      <p className="text-sm text-zinc-500 mt-1 mb-5">
        Stored locally in your browser only. We never see your keys.
      </p>

      <div className="space-y-4">
        <Input
          label="Groq API Key (recommended)"
          type="password"
          placeholder="gsk_..."
          value={groq}
          onChange={(e) => onGroq(e.target.value)}
          hint={
            <>
              Free key at{" "}
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:underline"
              >
                console.groq.com
              </a>{" "}
              · Fast Llama 3.3 70B
            </>
          }
        />
        <Input
          label="Gemini API Key (fallback)"
          type="password"
          placeholder="AIza..."
          value={gemini}
          onChange={(e) => onGemini(e.target.value)}
          hint={
            <>
              Free key at{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:underline"
              >
                aistudio.google.com
              </a>
            </>
          }
        />
      </div>

      <div className="flex items-center justify-between mt-7">
        <Button variant="ghost" icon={<ArrowLeft className="w-4 h-4" />} onClick={onBack}>
          Back
        </Button>
        <Button
          variant="primary"
          disabled={!canContinue}
          icon={<ArrowRight className="w-4 h-4" />}
          onClick={onNext}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

function ResumeStep({
  value,
  onChange,
  onPdf,
  parsing,
  error,
  onBack,
  onNext,
}: {
  value: string;
  onChange: (v: string) => void;
  onPdf: (file: File) => void;
  parsing: boolean;
  error: string;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-black text-zinc-900 flex items-center gap-2">
        <FileText className="w-5 h-5 text-indigo-500" /> Add your resume
      </h2>
      <p className="text-sm text-zinc-500 mt-1 mb-5">
        Paste plain text or upload a PDF. ReferMe uses this for autofill, ATS scoring,
        and tailored cover letters.
      </p>

      <div className="flex items-center gap-2 mb-3">
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold cursor-pointer hover:bg-zinc-50">
          <Upload className="w-3.5 h-3.5" />
          {parsing ? "Parsing…" : "Upload PDF"}
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPdf(f);
            }}
          />
        </label>
        {error && <span className="text-xs font-semibold text-red-600">{error}</span>}
      </div>

      <Textarea
        rows={10}
        placeholder="Paste your resume text here…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      <div className="flex items-center justify-between mt-7">
        <Button variant="ghost" icon={<ArrowLeft className="w-4 h-4" />} onClick={onBack}>
          Back
        </Button>
        <Button
          variant="primary"
          icon={<ArrowRight className="w-4 h-4" />}
          onClick={onNext}
          disabled={!value.trim()}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

function InstallStep({ onFinish }: { onFinish: () => void }) {
  return (
    <div>
      <h2 className="text-xl font-black text-zinc-900 flex items-center gap-2">
        <Puzzle className="w-5 h-5 text-indigo-500" /> Install the extension
      </h2>
      <p className="text-sm text-zinc-500 mt-1 mb-5">
        Optional — the dashboard works on its own, but the extension unlocks
        in-page autofill, ATS badges, and one-click save on every job site.
      </p>

      <ol className="space-y-2 text-sm text-zinc-700">
        {[
          "Download extension.zip from the GitHub Releases page.",
          "Unzip it anywhere on your machine.",
          "Open chrome://extensions and enable Developer mode.",
          "Click Load unpacked and pick the unzipped folder.",
          "Pin the ReferMe icon to your toolbar. Done.",
        ].map((line, i) => (
          <li key={i} className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-black flex items-center justify-center shrink-0">
              {i + 1}
            </span>
            <span className="pt-0.5">{line}</span>
          </li>
        ))}
      </ol>

      <a
        href="https://github.com/yokesh-kumar-M/ReferMe/releases/latest"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-zinc-800"
      >
        <ExternalLink className="w-4 h-4" /> Go to Releases
      </a>

      <div className="flex items-center justify-between mt-7">
        <Button variant="ghost" onClick={onFinish}>
          Skip for now
        </Button>
        <Button variant="primary" icon={<CheckCircle2 className="w-4 h-4" />} onClick={onFinish}>
          Finish setup
        </Button>
      </div>
    </div>
  );
}
