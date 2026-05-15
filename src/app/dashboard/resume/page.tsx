"use client";

// ATS Optimizer / Resume tailoring. Side-by-side resume editor + JD pane,
// live deterministic ATS score, AI-powered tailoring with streaming
// output, PDF export of the tailored result.

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  FileText, Target, Wand2, Download, Copy, Save, Upload,
  Loader2, CheckCircle2, AlertTriangle, X, RefreshCcw, Plus, Trash2,
} from "lucide-react";

import { useKeysStore, hasAnyKey } from "@/store/keysStore";
import { useProfileStore } from "@/store/profileStore";
import { useHistoryStore } from "@/store/historyStore";
import { scoreATS } from "@/features/ats/score";
import { streamText } from "@/features/ai/client";
import { systemPrompt, userPrompt } from "@/features/ai/prompts";
import { Button, Badge, ScoreRing, Input, Textarea, Card, CardHeader, CardBody } from "@/components/ui";
import { renderMarkdown } from "@/lib/utils";

const MarkdownView = dynamic(
  () =>
    Promise.resolve(({ html }: { html: string }) => (
      <div
        className="markdown-output prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )),
  { ssr: false }
);

export default function ResumeOptimizerPage() {
  const keys = useKeysStore();
  const profile = useProfileStore();
  const history = useHistoryStore();

  const [mounted, setMounted] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [renameValue, setRenameValue] = useState("");

  const [tailoring, setTailoring] = useState(false);
  const [tailoredText, setTailoredText] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [parsing, setParsing] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const active = profile.getActiveResume();
    setResumeText(active?.content ?? "");
    setRenameValue(active?.name ?? "");
  }, [mounted, profile.activeResumeId, profile.resumes, profile]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const ats = useMemo(
    () => scoreATS(resumeText, jobDescription),
    [resumeText, jobDescription]
  );

  if (!mounted) return null;

  function saveResume() {
    const active = profile.getActiveResume();
    if (active) {
      profile.updateResume(active.id, { content: resumeText, name: renameValue || active.name });
      setToast({ kind: "ok", text: "Resume saved" });
    } else {
      profile.addResume(renameValue || "Default Resume", resumeText);
      setToast({ kind: "ok", text: "Resume created" });
    }
  }

  function addProfile() {
    const id = profile.addResume(`Resume ${profile.resumes.length + 1}`, "");
    profile.setActiveResume(id);
  }

  function deleteProfile() {
    const active = profile.getActiveResume();
    if (!active) return;
    if (profile.resumes.length <= 1) {
      setToast({ kind: "err", text: "At least one resume profile is required" });
      return;
    }
    if (!confirm(`Delete resume "${active.name}"?`)) return;
    profile.deleteResume(active.id);
  }

  async function importPdf(file: File) {
    setParsing(true);
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
      setToast({ kind: "ok", text: "PDF parsed" });
    } catch (e) {
      setToast({
        kind: "err",
        text: e instanceof Error ? e.message : "Failed to parse PDF",
      });
    } finally {
      setParsing(false);
    }
  }

  async function runTailor() {
    if (!hasAnyKey(keys)) {
      setToast({ kind: "err", text: "Add an API key in Settings first" });
      return;
    }
    if (!resumeText.trim() || !jobDescription.trim()) {
      setToast({ kind: "err", text: "Paste a resume and a job description first" });
      return;
    }
    cancelRef.current = false;
    setTailoring(true);
    setTailoredText("");
    try {
      let acc = "";
      for await (const delta of streamText(
        { keys: keys.keys, models: keys.models, primary: keys.primary },
        {
          system: systemPrompt("custom_cv", {
            jobTitle,
            jobDescription,
            resume: resumeText,
            companyName: company,
          }),
          user: userPrompt("custom_cv", {
            jobTitle,
            jobDescription,
            resume: resumeText,
            companyName: company,
          }),
        }
      )) {
        if (cancelRef.current) break;
        acc += delta;
        setTailoredText(acc);
      }
      if (acc) {
        history.add({
          type: "custom_cv",
          jobTitle: jobTitle || "Untitled",
          company,
          result: acc,
        });
      }
    } catch (err) {
      setToast({ kind: "err", text: err instanceof Error ? err.message : "Tailoring failed" });
    } finally {
      setTailoring(false);
    }
  }

  function copyTailored() {
    if (!tailoredText) return;
    navigator.clipboard.writeText(tailoredText).catch(() => {});
    setToast({ kind: "ok", text: "Tailored resume copied" });
  }

  async function exportPdf() {
    if (!tailoredText) return;
    setPdfBusy(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const wrapper = document.createElement("div");
      wrapper.innerHTML = renderMarkdown(tailoredText);
      wrapper.style.padding = "24px";
      wrapper.style.fontFamily = "Arial, sans-serif";
      wrapper.style.color = "#000";
      await html2pdf()
        .set({
          margin: 10,
          filename: `Resume_${(jobTitle || "Tailored").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
          image: { type: "jpeg" as const, quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: "mm" as const, format: "a4", orientation: "portrait" as const },
        })
        .from(wrapper)
        .save();
    } catch (e) {
      setToast({ kind: "err", text: e instanceof Error ? e.message : "PDF export failed" });
    } finally {
      setPdfBusy(false);
    }
  }

  const tailoredHtml = useMemo(() => renderMarkdown(tailoredText), [tailoredText]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <header className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-zinc-900">ATS Optimizer</h1>
          <p className="text-sm text-zinc-500 mt-1">
            See keyword coverage, then have AI rewrite your resume for the JD.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={<Plus className="w-4 h-4" />} onClick={addProfile}>
            New profile
          </Button>
          <Button variant="primary" icon={<Save className="w-4 h-4" />} onClick={saveResume}>
            Save resume
          </Button>
        </div>
      </header>

      {toast && (
        <div
          className={
            "mb-4 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border " +
            (toast.kind === "ok"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-red-50 text-red-700 border-red-200")
          }
        >
          {toast.kind === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span className="flex-1">{toast.text}</span>
          <button onClick={() => setToast(null)} className="text-current opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Profile selector */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-3 mb-6 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mr-1">
          Active resume:
        </span>
        {profile.resumes.map((r) => (
          <button
            key={r.id}
            onClick={() => profile.setActiveResume(r.id)}
            className={
              "text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all " +
              (r.id === profile.activeResumeId
                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50")
            }
          >
            {r.name}
          </button>
        ))}
        <button
          onClick={deleteProfile}
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-red-500 hover:text-red-700 px-2 py-1"
          title="Delete active profile"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete active
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Resume side */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1">
                <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                <Input
                  fieldVariant="compact"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="font-bold !py-1.5 !px-2 max-w-[200px]"
                  placeholder="Resume name"
                />
              </div>
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold cursor-pointer hover:bg-zinc-50">
                <Upload className="w-3.5 h-3.5" />
                {parsing ? "Parsing…" : "Import PDF"}
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importPdf(f);
                  }}
                />
              </label>
            </div>
          </CardHeader>
          <CardBody>
            <Textarea
              rows={18}
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your resume text…"
              className="font-mono text-xs"
            />
          </CardBody>
        </Card>

        {/* JD side */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-bold text-zinc-800">Target Job</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setJobTitle("");
                  setCompany("");
                  setJobDescription("");
                }}
                icon={<RefreshCcw className="w-3.5 h-3.5" />}
              >
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Job title"
                placeholder="Senior Software Engineer"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
              <Input
                label="Company"
                placeholder="Acme"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <Textarea
              label="Job description"
              rows={14}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the full JD here. The more text, the better the score."
              className="text-xs"
            />
          </CardBody>
        </Card>
      </div>

      {/* Score + missing keywords */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
        <Card>
          <CardBody className="flex items-center gap-4">
            <ScoreRing score={ats.score} size={72} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">ATS Match</p>
              <p className="text-lg font-black text-zinc-900">
                {ats.score >= 75 ? "Strong fit" : ats.score >= 50 ? "Decent fit" : "Needs tailoring"}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {ats.matchedKeywords.length} / {ats.totalKeywords} keywords
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-bold text-zinc-800">Matched skills</span>
            </div>
          </CardHeader>
          <CardBody>
            {ats.matchedSkills.length === 0 ? (
              <p className="text-xs text-zinc-400">No tech skills detected yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {ats.matchedSkills.map((s) => (
                  <Badge key={s} tone="emerald">
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-bold text-zinc-800">Missing skills</span>
            </div>
          </CardHeader>
          <CardBody>
            {ats.missingSkills.length === 0 ? (
              <p className="text-xs text-zinc-400">Looks balanced — no obvious gaps.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {ats.missingSkills.slice(0, 14).map((s) => (
                  <Badge key={s} tone="amber">
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Tailoring */}
      <Card className="mt-5">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-bold text-zinc-800">AI-tailored resume</span>
            </div>
            <div className="flex items-center gap-2">
              {tailoring ? (
                <Button
                  variant="outline"
                  size="sm"
                  icon={<X className="w-3.5 h-3.5" />}
                  onClick={() => {
                    cancelRef.current = true;
                  }}
                >
                  Stop
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Wand2 className="w-3.5 h-3.5" />}
                  onClick={runTailor}
                  disabled={!resumeText.trim() || !jobDescription.trim()}
                >
                  Tailor with AI
                </Button>
              )}
              {tailoredText && !tailoring && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Copy className="w-3.5 h-3.5" />}
                    onClick={copyTailored}
                  >
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Download className="w-3.5 h-3.5" />}
                    onClick={exportPdf}
                    loading={pdfBusy}
                  >
                    PDF
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {tailoring && !tailoredText && (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              Generating tailored resume…
            </div>
          )}
          {tailoredText ? (
            <MarkdownView html={tailoredHtml} />
          ) : !tailoring ? (
            <p className="text-xs text-zinc-400">
              Click <span className="font-bold text-zinc-700">Tailor with AI</span> to rewrite
              the resume above so it hits the JD&apos;s exact keywords. No experience is invented.
            </p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
