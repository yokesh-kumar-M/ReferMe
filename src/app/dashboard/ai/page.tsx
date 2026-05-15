"use client";

// Unified AI Toolkit. Pick a generation type, drop in JD context, stream
// the output. Saves to history. Copy / email / restore from history.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles, FileText, Wand2, Copy, Mail, X, Loader2,
  Clock, ChevronRight, Trash2,
} from "lucide-react";

import { useKeysStore, hasAnyKey } from "@/store/keysStore";
import { useProfileStore } from "@/store/profileStore";
import { useHistoryStore } from "@/store/historyStore";
import { streamText } from "@/features/ai/client";
import { systemPrompt, userPrompt, GENERATION_LABELS, GENERATION_DESCRIPTIONS } from "@/features/ai/prompts";
import type { GenerationType } from "@/types";
import { Button, Input, Textarea, Card, CardHeader, CardBody, Badge } from "@/components/ui";
import { renderMarkdown } from "@/lib/utils";

const TYPES: GenerationType[] = [
  "cover_letter",
  "referral",
  "cold_mail",
  "linkedin",
  "match_analyzer",
  "interview_prep",
  "thank_you",
  "custom_cv",
];

export default function AIToolkitPage() {
  const keys = useKeysStore();
  const profile = useProfileStore();
  const history = useHistoryStore();

  const [mounted, setMounted] = useState(false);
  const [type, setType] = useState<GenerationType>("cover_letter");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [recruiterName, setRecruiterName] = useState("");
  const [recruiterEmail, setRecruiterEmail] = useState("");
  const [sharedConnection, setSharedConnection] = useState("");

  const [streaming, setStreaming] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");

  const cancelRef = useRef(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  async function run() {
    if (!hasAnyKey(keys)) {
      setError("Add an API key in Settings first");
      return;
    }
    const resume = profile.getActiveResumeText();
    if (!resume) {
      setError("Add a resume in the ATS Optimizer first");
      return;
    }
    if (!jobDescription.trim()) {
      setError("Paste a job description first");
      return;
    }
    cancelRef.current = false;
    setStreaming(true);
    setError("");
    setOutput("");
    try {
      const ctx = {
        jobTitle,
        jobDescription,
        resume,
        companyName: company,
        recruiterName,
        recruiterEmail,
        sharedConnection: sharedConnection.trim() || undefined,
      };
      let acc = "";
      for await (const delta of streamText(
        { keys: keys.keys, models: keys.models, primary: keys.primary },
        {
          system: systemPrompt(type, ctx),
          user: userPrompt(type, ctx),
        }
      )) {
        if (cancelRef.current) break;
        acc += delta;
        setOutput(acc);
      }
      if (acc) {
        history.add({ type, jobTitle: jobTitle || "Untitled", company, result: acc });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setStreaming(false);
    }
  }

  function copyOutput() {
    if (!output) return;
    navigator.clipboard.writeText(output).catch(() => {});
  }

  function mailOutput() {
    if (!output) return;
    let subject = jobTitle ? `Application for ${jobTitle}` : "Job Application";
    let body = output;
    const m = output.match(/^Subject:\s*(.+)$/m);
    if (m) {
      subject = m[1].trim();
      body = output.replace(/^Subject:\s*(.+)$/m, "").trim();
    }
    const to = encodeURIComponent(recruiterEmail);
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank", "noreferrer");
  }

  const outputHtml = useMemo(() => renderMarkdown(output), [output]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <header className="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black text-zinc-900">AI Toolkit</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Generate cover letters, outreach, and interview prep using your resume
            and a job description.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-bold text-zinc-800">Generation type</span>
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={
                      "text-left rounded-xl border px-3 py-2.5 transition-all " +
                      (type === t
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm"
                        : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50")
                    }
                  >
                    <p className="text-xs font-bold">{GENERATION_LABELS[t]}</p>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-zinc-500 mt-3 leading-relaxed">
                {GENERATION_DESCRIPTIONS[type]}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-bold text-zinc-800">Job context</span>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Job title"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Senior Software Engineer"
                />
                <Input
                  label="Company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme"
                />
              </div>
              <Textarea
                label="Job description"
                rows={8}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Recruiter name"
                  value={recruiterName}
                  onChange={(e) => setRecruiterName(e.target.value)}
                  placeholder="(optional)"
                />
                <Input
                  label="Recruiter email"
                  value={recruiterEmail}
                  onChange={(e) => setRecruiterEmail(e.target.value)}
                  placeholder="(optional)"
                />
              </div>
              <Input
                label="Shared connection"
                value={sharedConnection}
                onChange={(e) => setSharedConnection(e.target.value)}
                placeholder="e.g. Both attended Stanford"
                hint="Used as a warm intro hook for referrals and cold mail."
              />
            </CardBody>
          </Card>

          <div className="flex items-center gap-2">
            {streaming ? (
              <Button variant="outline" icon={<X className="w-4 h-4" />} onClick={() => (cancelRef.current = true)}>
                Stop
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                icon={<Wand2 className="w-4 h-4" />}
                onClick={run}
                disabled={!jobDescription.trim()}
              >
                Generate
              </Button>
            )}
            {error && <span className="text-xs font-semibold text-red-600">{error}</span>}
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-bold text-zinc-800">Output</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" icon={<Copy className="w-3.5 h-3.5" />} onClick={copyOutput} disabled={!output}>
                    Copy
                  </Button>
                  <Button variant="ghost" size="sm" icon={<Mail className="w-3.5 h-3.5" />} onClick={mailOutput} disabled={!output}>
                    Email
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardBody>
              {streaming && !output && (
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  Streaming response…
                </div>
              )}
              {output ? (
                <div
                  className="markdown-output prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: outputHtml }}
                />
              ) : !streaming ? (
                <p className="text-xs text-zinc-400">
                  Output will appear here as the model streams it. Generations are saved
                  to your history below.
                </p>
              ) : null}
            </CardBody>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-zinc-500" />
                  <span className="text-sm font-bold text-zinc-800">History</span>
                </div>
                {history.entries.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm("Clear all generations?")) history.clear();
                    }}
                    className="text-[11px] font-bold text-red-500 hover:text-red-700"
                  >
                    Clear
                  </button>
                )}
              </div>
            </CardHeader>
            <CardBody className="!p-0">
              {history.entries.length === 0 ? (
                <p className="text-xs text-zinc-400 p-5 text-center">No generations yet.</p>
              ) : (
                <ul className="divide-y divide-zinc-50 max-h-[640px] overflow-y-auto custom-scrollbar">
                  {history.entries.map((e) => (
                    <li key={e.id} className="px-4 py-3 hover:bg-zinc-50/50 transition-colors">
                      <div className="flex items-start gap-2">
                        <Badge tone="violet">{GENERATION_LABELS[e.type]}</Badge>
                        <button
                          onClick={() => history.remove(e.id)}
                          className="ml-auto text-zinc-300 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs font-bold text-zinc-800 mt-1.5 truncate">
                        {e.jobTitle || "Untitled"} {e.company ? `· ${e.company}` : ""}
                      </p>
                      <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5">
                        {e.result.slice(0, 140)}…
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <button
                          onClick={() => {
                            setOutput(e.result);
                            setType(e.type);
                            setJobTitle(e.jobTitle || "");
                            setCompany(e.company || "");
                          }}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
                        >
                          Restore <ChevronRight className="w-3 h-3" />
                        </button>
                        <span className="text-[10px] text-zinc-400 ml-auto">
                          {new Date(e.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
