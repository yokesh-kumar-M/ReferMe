"use client";

// Slim command-bar popup. Works in both:
//   - Toolbar popup window (chrome.tabs available, no window.parent bridge)
//   - Side-panel iframe inside a job page (window.parent bridge available)
//
// Talks to the content script via the messaging bridge so autofill / job
// extraction work from either context.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, FileText, Send, ClipboardCopy, ExternalLink, Settings,
  Briefcase, Wand2, Bookmark, AlertTriangle, CheckCircle2, X,
  LayoutDashboard, Loader2, Mail, RefreshCcw,
} from "lucide-react";

import { useKeysStore, hasAnyKey } from "@/store/keysStore";
import { useProfileStore } from "@/store/profileStore";
import { useTrackerStore } from "@/store/trackerStore";
import { useHistoryStore } from "@/store/historyStore";

import { Button, Badge, ScoreRing, Input } from "@/components/ui";
import { detectContext, sendToActiveTab, getActiveTab, onRuntimeMessage, onWindowMessage } from "@/extension/messaging";
import { runAutofill } from "@/features/autofill/runAutofill";
import { scoreATS } from "@/features/ats/score";
import { streamText, generateJSON } from "@/features/ai/client";
import { systemPrompt, userPrompt } from "@/features/ai/prompts";
import type { JobContext, UserProfile } from "@/types";

type Tab = "summary" | "actions" | "ai" | "settings";

interface JobState {
  job: JobContext | null;
  loading: boolean;
}

const EMPTY_JOB: JobContext = {
  jobTitle: "",
  company: "",
  location: "",
  jobDescription: "",
  jobUrl: "",
  platform: "",
};

export default function Popup() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [jobState, setJobState] = useState<JobState>({ job: null, loading: true });
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [streamLabel, setStreamLabel] = useState("");
  const [autofilling, setAutofilling] = useState(false);

  const keys = useKeysStore();
  const profile = useProfileStore();
  const tracker = useTrackerStore();
  const history = useHistoryStore();

  const context = useMemo(() => detectContext(), []);
  const cancelRef = useRef(false);

  // ──────────────────────────────────────────────────────────────────
  // Mount + listen for job-detected messages from content script
  // ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);

    let cancelled = false;

    const loadActiveJob = async () => {
      // Ask the content script directly. Works in toolbar-popup, side-panel,
      // and dashboard contexts.
      try {
        const reply = await sendToActiveTab<{ job: JobContext | null }>({
          type: "content/extract-job",
        });
        if (!cancelled && reply?.job) {
          setJobState({ job: reply.job, loading: false });
          return;
        }
      } catch (_) {}
      if (!cancelled) setJobState((s) => ({ ...s, loading: false }));
    };

    loadActiveJob();

    const offRuntime = onRuntimeMessage((msg) => {
      if (msg.type === "content/job-detected" && msg.job) {
        setJobState({ job: msg.job, loading: false });
      }
    });
    const offWindow = onWindowMessage((msg) => {
      if (msg.type === "content/job-detected" && msg.job) {
        setJobState({ job: msg.job, loading: false });
      }
    });

    return () => {
      cancelled = true;
      offRuntime();
      offWindow();
    };
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ──────────────────────────────────────────────────────────────────
  // Derived state
  // ──────────────────────────────────────────────────────────────────
  const job = jobState.job ?? EMPTY_JOB;
  const apiReady = hasAnyKey(keys);
  const resumeText = profile.getActiveResumeText();
  const ats = useMemo(
    () => scoreATS(resumeText, job.jobDescription),
    [resumeText, job.jobDescription]
  );

  // ──────────────────────────────────────────────────────────────────
  // Actions
  // ──────────────────────────────────────────────────────────────────
  function openDashboard() {
    const inExt = typeof chrome !== "undefined" && !!chrome.runtime?.getURL;
    const url = inExt ? chrome.runtime.getURL("dashboard/index.html") : "/dashboard/";
    if (inExt && chrome.tabs?.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, "_blank", "noreferrer");
    }
  }

  function openOnboarding() {
    const inExt = typeof chrome !== "undefined" && !!chrome.runtime?.getURL;
    const url = inExt
      ? chrome.runtime.getURL("dashboard/settings/index.html")
      : "/dashboard/settings/";
    if (inExt && chrome.tabs?.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, "_blank", "noreferrer");
    }
  }

  async function refreshJob() {
    setJobState({ job: null, loading: true });
    const reply = await sendToActiveTab<{ job: JobContext | null }>({
      type: "content/extract-job",
    });
    setJobState({ job: reply?.job ?? null, loading: false });
  }

  async function saveJobToTracker() {
    if (!job.jobTitle) return;
    tracker.addApplication({
      jobTitle: job.jobTitle,
      company: job.company,
      location: job.location,
      jobUrl: job.jobUrl,
      jobDescription: job.jobDescription,
      source: job.platform || "popup",
      status: "saved",
      atsScore: ats.score,
      matchedKeywords: ats.matchedKeywords.slice(0, 30),
      missingKeywords: ats.missingKeywords.slice(0, 30),
    });
    setToast({ kind: "ok", text: "Saved to tracker" });
  }

  async function doAutofill() {
    if (!apiReady) {
      setToast({ kind: "err", text: "Add an API key in Settings first" });
      setActiveTab("settings");
      return;
    }
    setAutofilling(true);
    try {
      let userProfile: UserProfile = profile.profile;

      // If the profile is mostly empty, ask the LLM to extract from the resume.
      const looksEmpty = !userProfile.firstName && !userProfile.email;
      if (looksEmpty && resumeText) {
        const extracted = await generateJSON<Partial<UserProfile>>(
          { keys: keys.keys, models: keys.models, primary: keys.primary },
          {
            system: `Extract personal info from the resume below.
Return ONLY a JSON object with these keys (use empty strings when unknown):
{"firstName":"","lastName":"","email":"","phone":"","linkedin":"","github":"","website":"","city":"","state":"","country":""}`,
            user: resumeText,
            temperature: 0.1,
          }
        );
        userProfile = { ...userProfile, ...extracted };
        // Persist what we learned so subsequent autofills are instant.
        profile.setProfile(extracted);
      }

      const lastCoverLetter = history.byType("cover_letter")[0]?.result;
      const result = await runAutofill(userProfile, lastCoverLetter);
      if (result.filled === 0) {
        setToast({
          kind: "err",
          text: "No form fields detected on this page",
        });
      } else {
        setToast({
          kind: "ok",
          text: `Autofilled ${result.filled} field${result.filled === 1 ? "" : "s"}`,
        });
      }
    } catch (err) {
      setToast({ kind: "err", text: err instanceof Error ? err.message : "Autofill failed" });
    } finally {
      setAutofilling(false);
    }
  }

  async function generateCoverLetter() {
    if (!apiReady) {
      setActiveTab("settings");
      setToast({ kind: "err", text: "Add an API key in Settings first" });
      return;
    }
    if (!resumeText) {
      setToast({ kind: "err", text: "Upload a resume in Settings first" });
      return;
    }
    if (!job.jobDescription) {
      setToast({ kind: "err", text: "No job description detected" });
      return;
    }

    cancelRef.current = false;
    setStreaming(true);
    setStreamLabel("Cover Letter");
    setStreamedText("");
    setActiveTab("ai");

    try {
      let text = "";
      for await (const delta of streamText(
        { keys: keys.keys, models: keys.models, primary: keys.primary },
        {
          system: systemPrompt("cover_letter", {
            jobTitle: job.jobTitle,
            jobDescription: job.jobDescription,
            resume: resumeText,
            companyName: job.company,
          }),
          user: userPrompt("cover_letter", {
            jobTitle: job.jobTitle,
            jobDescription: job.jobDescription,
            resume: resumeText,
            companyName: job.company,
          }),
        }
      )) {
        if (cancelRef.current) break;
        text += delta;
        setStreamedText(text);
      }
      if (text) {
        history.add({
          type: "cover_letter",
          jobTitle: job.jobTitle,
          company: job.company,
          result: text,
        });
      }
    } catch (err) {
      setToast({ kind: "err", text: err instanceof Error ? err.message : "Generation failed" });
    } finally {
      setStreaming(false);
    }
  }

  function copyResult() {
    if (!streamedText) return;
    navigator.clipboard.writeText(streamedText).catch(() => {});
    setToast({ kind: "ok", text: "Copied to clipboard" });
  }

  function mailResult() {
    if (!streamedText) return;
    let subject = job.jobTitle ? `Application for ${job.jobTitle}` : "Job Application";
    let body = streamedText;
    const m = streamedText.match(/^Subject:\s*(.+)$/m);
    if (m) {
      subject = m[1].trim();
      body = streamedText.replace(/^Subject:\s*(.+)$/m, "").trim();
    }
    const url = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank", "noreferrer");
  }

  if (!mounted) {
    return (
      <div className="min-h-[600px] flex items-center justify-center bg-zinc-50">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!apiReady) {
    return <FirstRunPanel onOpenDashboard={openOnboarding} />;
  }

  return (
    <div className="min-w-[440px] max-w-[460px] min-h-[600px] bg-zinc-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-zinc-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-black text-zinc-900">ReferMe</p>
            <p className="text-[10px] text-zinc-500">{context === "side-panel" ? "Side Panel" : "Toolbar"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={refreshJob}
            className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500"
            title="Re-detect job"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
          <button
            onClick={openDashboard}
            className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500"
            title="Open dashboard"
          >
            <LayoutDashboard className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex items-center px-4 gap-1 bg-white border-b border-zinc-100">
        {(["summary", "actions", "ai", "settings"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={
              "flex-1 text-[11px] font-bold uppercase tracking-wider py-2.5 border-b-2 transition-colors " +
              (activeTab === t
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-zinc-400 hover:text-zinc-700")
            }
          >
            {t}
          </button>
        ))}
      </nav>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={
              "mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold " +
              (toast.kind === "ok"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-red-50 text-red-700 border border-red-200")
            }
          >
            {toast.kind === "ok" ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            <span className="flex-1">{toast.text}</span>
            <button onClick={() => setToast(null)} className="text-current opacity-60 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === "summary" && (
          <SummaryTab
            job={job}
            loading={jobState.loading}
            atsScore={ats.score}
            keywordsMatched={ats.matchedKeywords.length}
            keywordsTotal={ats.totalKeywords}
            onSave={saveJobToTracker}
            onRefresh={refreshJob}
          />
        )}
        {activeTab === "actions" && (
          <ActionsTab
            job={job}
            autofilling={autofilling}
            onAutofill={doAutofill}
            onCoverLetter={generateCoverLetter}
            onSave={saveJobToTracker}
            onDashboard={openDashboard}
            disabled={!job.jobTitle}
          />
        )}
        {activeTab === "ai" && (
          <AITab
            label={streamLabel}
            streaming={streaming}
            text={streamedText}
            onCopy={copyResult}
            onMail={mailResult}
            onCancel={() => {
              cancelRef.current = true;
            }}
            onGenerate={generateCoverLetter}
            jobReady={!!job.jobDescription}
            history={history.entries.slice(0, 5)}
          />
        )}
        {activeTab === "settings" && (
          <SettingsTab onOpenFullSettings={openDashboard} />
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Sub-views
// ──────────────────────────────────────────────────────────────────────

function FirstRunPanel({ onOpenDashboard }: { onOpenDashboard: () => void }) {
  return (
    <div className="min-w-[440px] min-h-[600px] flex items-center justify-center bg-zinc-50 p-6">
      <div className="max-w-sm bg-white rounded-3xl p-7 shadow-md border border-zinc-200/80 text-center">
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-md">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-xl font-black text-zinc-900">Welcome to ReferMe</h2>
        <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
          One-click apply, AI cover letters, and ATS scoring — using your own free
          Groq or Gemini key.
        </p>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          icon={<Settings className="w-4 h-4" />}
          onClick={onOpenDashboard}
          className="mt-6"
        >
          Set up in Dashboard
        </Button>
        <p className="text-[10px] text-zinc-400 mt-3">
          Your key is stored locally in your browser. Nothing is ever sent to our servers.
        </p>
      </div>
    </div>
  );
}

function SummaryTab({
  job,
  loading,
  atsScore,
  keywordsMatched,
  keywordsTotal,
  onSave,
  onRefresh,
}: {
  job: JobContext;
  loading: boolean;
  atsScore: number;
  keywordsMatched: number;
  keywordsTotal: number;
  onSave: () => void;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center gap-3 text-zinc-500">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-xs">Reading the page…</p>
      </div>
    );
  }
  if (!job.jobTitle) {
    return (
      <div className="p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-3 bg-zinc-100 rounded-2xl flex items-center justify-center">
          <Briefcase className="w-5 h-5 text-zinc-400" />
        </div>
        <p className="text-sm font-bold text-zinc-700">No job detected</p>
        <p className="text-xs text-zinc-500 mt-1 mb-4">
          Open a LinkedIn job posting, Greenhouse, Workday, Lever, or Indeed
          listing to see context here.
        </p>
        <Button variant="outline" size="sm" icon={<RefreshCcw className="w-3.5 h-3.5" />} onClick={onRefresh}>
          Try again
        </Button>
      </div>
    );
  }
  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center shrink-0">
            <Briefcase className="w-5 h-5 text-zinc-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-zinc-900 truncate">{job.jobTitle}</p>
            <p className="text-xs text-zinc-500 truncate mt-0.5">
              {[job.company, job.location].filter(Boolean).join(" · ")}
            </p>
            {job.platform && (
              <Badge tone="indigo" className="mt-2">
                {job.platform}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 flex items-center gap-4">
        <ScoreRing score={atsScore} size={56} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            ATS Match
          </p>
          <p className="text-base font-black text-zinc-900">
            {atsScore >= 75
              ? "Strong fit"
              : atsScore >= 50
              ? "Decent fit"
              : "Tailor your resume"}
          </p>
          <p className="text-[11px] text-zinc-500">
            {keywordsMatched} of {keywordsTotal} keywords matched
          </p>
        </div>
      </div>

      <Button
        variant="primary"
        fullWidth
        icon={<Bookmark className="w-4 h-4" />}
        onClick={onSave}
      >
        Save to Tracker
      </Button>
    </div>
  );
}

function ActionsTab({
  job,
  autofilling,
  onAutofill,
  onCoverLetter,
  onSave,
  onDashboard,
  disabled,
}: {
  job: JobContext;
  autofilling: boolean;
  onAutofill: () => void;
  onCoverLetter: () => void;
  onSave: () => void;
  onDashboard: () => void;
  disabled: boolean;
}) {
  return (
    <div className="p-4 space-y-2.5">
      <ActionRow
        icon={<Wand2 className="w-4 h-4" />}
        label="Autofill application"
        hint="Fills detected form fields with your saved profile"
        cta="Run"
        loading={autofilling}
        disabled={disabled}
        onClick={onAutofill}
      />
      <ActionRow
        icon={<FileText className="w-4 h-4" />}
        label="Generate cover letter"
        hint="Tailored 3-paragraph cover letter for this JD"
        cta="Write"
        disabled={disabled}
        onClick={onCoverLetter}
      />
      <ActionRow
        icon={<Bookmark className="w-4 h-4" />}
        label="Save to tracker"
        hint="Add this job to your Kanban board"
        cta="Save"
        disabled={!job.jobTitle}
        onClick={onSave}
      />
      <ActionRow
        icon={<LayoutDashboard className="w-4 h-4" />}
        label="Open dashboard"
        hint="Resume builder, networking, analytics"
        cta="Open"
        onClick={onDashboard}
      />
    </div>
  );
}

function ActionRow({
  icon,
  label,
  hint,
  cta,
  onClick,
  disabled,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  cta: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-zinc-200/80 hover:border-indigo-200 hover:bg-indigo-50/30 disabled:opacity-50 disabled:hover:bg-white transition-colors"
    >
      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-zinc-800 truncate">{label}</p>
        <p className="text-xs text-zinc-500 truncate">{hint}</p>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 shrink-0 flex items-center gap-1">
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        {cta}
      </span>
    </button>
  );
}

function AITab({
  label,
  streaming,
  text,
  onCopy,
  onMail,
  onCancel,
  onGenerate,
  jobReady,
  history,
}: {
  label: string;
  streaming: boolean;
  text: string;
  onCopy: () => void;
  onMail: () => void;
  onCancel: () => void;
  onGenerate: () => void;
  jobReady: boolean;
  history: ReturnType<typeof useHistoryStore.getState>["entries"];
}) {
  return (
    <div className="p-4 space-y-3">
      {!text && !streaming && (
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 text-center">
          <div className="w-10 h-10 mx-auto mb-3 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <Sparkles className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-zinc-800">Generate for this job</p>
          <p className="text-xs text-zinc-500 mt-1 mb-3">
            Pick an action to draft cover letters, outreach, or interview prep.
          </p>
          <Button
            variant="primary"
            size="sm"
            icon={<FileText className="w-4 h-4" />}
            onClick={onGenerate}
            disabled={!jobReady}
            fullWidth
          >
            Cover letter (popup)
          </Button>
          <p className="text-[10px] text-zinc-400 mt-2">
            For more types open the dashboard&apos;s AI Toolkit.
          </p>
        </div>
      )}

      {(text || streaming) && (
        <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-100">
            <p className="text-xs font-bold text-zinc-700">{label || "Output"}</p>
            <div className="flex items-center gap-1">
              {streaming ? (
                <Button variant="ghost" size="sm" onClick={onCancel}>
                  Stop
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" icon={<ClipboardCopy className="w-3.5 h-3.5" />} onClick={onCopy}>
                    Copy
                  </Button>
                  <Button variant="ghost" size="sm" icon={<Mail className="w-3.5 h-3.5" />} onClick={onMail}>
                    Email
                  </Button>
                </>
              )}
            </div>
          </div>
          <pre className="text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed p-4 max-h-[260px] overflow-y-auto custom-scrollbar font-sans">
            {text || (streaming ? "Generating…" : "")}
          </pre>
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden">
          <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-100">
            Recent
          </p>
          <ul className="divide-y divide-zinc-50">
            {history.map((entry) => (
              <li key={entry.id} className="px-4 py-2.5 flex items-center gap-2">
                <Badge tone="violet">{entry.type.replace("_", " ")}</Badge>
                <span className="text-xs font-semibold text-zinc-700 truncate flex-1">
                  {entry.jobTitle || "Untitled"}
                </span>
                <span className="text-[10px] text-zinc-400 shrink-0">
                  {new Date(entry.timestamp).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SettingsTab({ onOpenFullSettings }: { onOpenFullSettings: () => void }) {
  const keys = useKeysStore();
  return (
    <div className="p-4 space-y-3">
      <Input
        label="Groq API Key"
        type="password"
        placeholder="gsk_..."
        value={keys.keys.groq}
        onChange={(e) => keys.setKey("groq", e.target.value)}
        hint="Free, fast — recommended primary"
      />
      <Input
        label="Gemini API Key"
        type="password"
        placeholder="AIza..."
        value={keys.keys.gemini}
        onChange={(e) => keys.setKey("gemini", e.target.value)}
        hint="Fallback when Groq is rate-limited"
      />
      <Button
        variant="outline"
        fullWidth
        icon={<ExternalLink className="w-4 h-4" />}
        onClick={onOpenFullSettings}
      >
        Full settings, resume, profile
      </Button>
    </div>
  );
}
