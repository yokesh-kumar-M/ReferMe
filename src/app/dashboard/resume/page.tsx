"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/store/appStore";
import { useDashboardStore } from "@/store/dashboardStore";
import { sanitizeText } from "@/lib/utils";
import {
  FileText, Upload, Target, CheckCircle2, AlertCircle,
  X, Plus, ChevronDown, RefreshCw, Info,
  BookOpen, Zap, Copy
} from "lucide-react";

interface ATSResult {
  score: number;
  matched: string[];
  missing: string[];
  suggestions: string[];
  optimizedBullets: string[];
  summary: string;
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const strokeDashoffset = 251.2 * (1 - score / 100);
  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#f4f4f5" strokeWidth="8" />
        <motion.circle
          cx="50" cy="50" r="40" fill="none"
          stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray="251.2"
          initial={{ strokeDashoffset: 251.2 }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="relative text-center">
        <motion.p
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="text-3xl font-black"
          style={{ color }}
        >
          {score}
        </motion.p>
        <p className="text-xs font-bold text-zinc-400 -mt-0.5">/ 100</p>
      </div>
    </div>
  );
}

function KeywordPill({ word, matched }: { word: string; matched: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(word); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-all hover:shadow-sm ${
        matched
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
          : "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
      }`}
      title={copied ? "Copied!" : "Click to copy"}
    >
      {copied ? "✓" : (matched ? "✓ " : "✗ ")}{word}
    </button>
  );
}

export default function ResumePage() {
  const { resumeProfiles, activeProfileId, setActiveProfileId, getActiveResume, addResumeProfile, updateResumeProfile, groqApiKey, geminiApiKey } = useAppStore();
  const { applications } = useDashboardStore();
  const [mounted, setMounted] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ATSResult | null>(null);
  const [error, setError] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<"keywords" | "suggestions" | "bullets">("keywords");
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const hasKey = groqApiKey || geminiApiKey;

  const analyzeResume = async () => {
    if (!getActiveResume()) { setError("Please upload a resume first."); return; }
    if (!jobDescription) { setError("Please paste a job description."); return; }
    if (!hasKey) { setError("Please add a Groq or Gemini API key in Settings."); return; }

    setLoading(true);
    setError("");
    setResult(null);

    const systemPrompt = `You are an expert ATS (Applicant Tracking System) analyst and resume coach.
Analyze the candidate's resume against the job description and return a JSON response.

CRITICAL: Return ONLY valid JSON, no markdown, no backticks. Structure:
{
  "score": <0-100 integer>,
  "matched": ["keyword1", "keyword2", ...],
  "missing": ["keyword1", "keyword2", ...],
  "suggestions": ["Actionable suggestion 1", "Actionable suggestion 2", ...],
  "optimizedBullets": ["Rewritten bullet 1", "Rewritten bullet 2", "Rewritten bullet 3"],
  "summary": "2-3 sentence executive summary of the fit"
}

Rules:
- score: ATS compatibility score considering keyword match, format, and relevance
- matched: keywords/phrases from JD found in resume (max 15)
- missing: important keywords from JD NOT in resume (max 15)
- suggestions: 4-6 specific, actionable improvement suggestions
- optimizedBullets: 3 rewritten resume bullets that better match the JD (use quantified achievements)
- summary: concise assessment of candidate fit`;

    const userPrompt = `JOB TITLE: ${sanitizeText(jobTitle || "Job Position")}
JOB DESCRIPTION:
${sanitizeText(jobDescription)}

CANDIDATE RESUME:
${getActiveResume()}`;

    try {
      let jsonText = "";
      if (groqApiKey) {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqApiKey}` },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            temperature: 0.2,
            response_format: { type: "json_object" }
          })
        });
        if (!res.ok) throw new Error(`Groq error ${res.status}`);
        const data = await res.json();
        jsonText = data.choices[0].message.content;
      } else if (geminiApiKey) {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
          })
        });
        if (!res.ok) throw new Error(`Gemini error ${res.status}`);
        const data = await res.json();
        jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      }
      const parsed: ATSResult = JSON.parse(jsonText);
      setResult(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to analyze resume.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== "application/pdf") { setError("Please upload a PDF file."); return; }
    setLoading(true);
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      const ab = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: unknown) => ('str' in (item as object) ? (item as { str: string }).str : '')).join(" ") + "\n";
      }
      updateResumeProfile(activeProfileId, { content: text.trim() });
    } catch {
      setError("Failed to parse PDF.");
    } finally {
      setLoading(false);
    }
  };

  const copyBullets = () => {
    if (!result?.optimizedBullets) return;
    navigator.clipboard.writeText(result.optimizedBullets.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadFromTracker = (jobId: string) => {
    const app = applications.find(a => a.id === jobId);
    if (app) { setJobDescription(app.jobDescription); setJobTitle(app.jobTitle); }
  };

  const activeResume = getActiveResume();
  const hasResume = !!activeResume;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-black text-zinc-900">ATS Resume Optimizer</h1>
        <p className="text-xs text-zinc-400 mt-0.5">Analyze keyword gaps, get your ATS score, and optimize your resume for any job.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Inputs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Resume Profile */}
          <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-800 mb-3 flex items-center gap-2">
              <FileText size={16} className="text-indigo-500" /> Resume Profile
            </h2>
            <div className="relative mb-3">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-700 hover:border-indigo-300 transition-all"
              >
                <span className="truncate">{resumeProfiles.find(p => p.id === activeProfileId)?.name || "Default Resume"}</span>
                <ChevronDown size={14} className={`text-zinc-400 transition-transform shrink-0 ${showProfileMenu ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {showProfileMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute z-10 top-full mt-1 w-full bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden"
                  >
                    {resumeProfiles.map(p => (
                      <div key={p.id}
                        onClick={() => { setActiveProfileId(p.id); setShowProfileMenu(false); }}
                        className={`px-3 py-2.5 cursor-pointer text-sm transition-all ${p.id === activeProfileId ? "bg-indigo-50 text-indigo-700 font-bold" : "hover:bg-zinc-50 text-zinc-700"}`}
                      >{p.name}</div>
                    ))}
                    {showNewProfile ? (
                      <div className="px-3 py-2 border-t border-zinc-100 flex gap-2">
                        <input value={newProfileName} onChange={e => setNewProfileName(e.target.value)}
                          placeholder="Profile name..." autoFocus
                          onKeyDown={e => { if (e.key === "Enter" && newProfileName.trim()) { addResumeProfile(newProfileName.trim(), ""); setNewProfileName(""); setShowNewProfile(false); setShowProfileMenu(false); }}}
                          className="flex-1 px-2 py-1 text-sm rounded-lg border border-zinc-200 outline-none focus:border-indigo-400" />
                        <button onClick={() => { if (newProfileName.trim()) { addResumeProfile(newProfileName.trim(), ""); setNewProfileName(""); setShowNewProfile(false); setShowProfileMenu(false); }}}
                          className="bg-indigo-500 text-white px-3 py-1 rounded-lg text-xs font-bold">Add</button>
                      </div>
                    ) : (
                      <button onClick={() => setShowNewProfile(true)}
                        className="w-full px-3 py-2.5 text-sm text-indigo-600 font-bold hover:bg-indigo-50 border-t border-zinc-100 flex items-center gap-2">
                        <Plus size={14} /> New Profile
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {hasResume ? (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-emerald-800">Resume loaded</p>
                  <p className="text-[10px] text-emerald-600">{activeResume.length.toLocaleString()} characters</p>
                </div>
                <button onClick={() => fileRef.current?.click()} className="text-xs font-bold text-emerald-700 hover:text-emerald-900">Replace</button>
              </div>
            ) : (
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-zinc-200 hover:border-indigo-300 rounded-xl p-6 text-center cursor-pointer transition-all group">
                <Upload size={20} className="text-zinc-300 group-hover:text-indigo-400 mx-auto mb-2 transition-colors" />
                <p className="text-xs font-bold text-zinc-500 group-hover:text-indigo-600">Upload PDF Resume</p>
              </div>
            )}
            <input type="file" accept="application/pdf" ref={fileRef} onChange={handleFileUpload} className="hidden" />
          </div>

          {/* Job Description */}
          <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
                <BookOpen size={16} className="text-indigo-500" /> Job Description
              </h2>
              {applications.filter(a => a.jobDescription).length > 0 && (
                <select onChange={e => e.target.value && loadFromTracker(e.target.value)}
                  className="text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg px-2 py-1 bg-indigo-50 outline-none cursor-pointer">
                  <option value="">Load from Tracker</option>
                  {applications.filter(a => a.jobDescription).map(a => (
                    <option key={a.id} value={a.id}>{a.jobTitle} @ {a.company}</option>
                  ))}
                </select>
              )}
            </div>
            <input value={jobTitle} onChange={e => setJobTitle(e.target.value)}
              placeholder="Job Title (optional)"
              className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 outline-none mb-2 transition-all" />
            <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)}
              rows={8} placeholder="Paste the full job description here..."
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 outline-none resize-none transition-all" />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 rounded-xl p-3 text-sm">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
              <button onClick={() => setError("")} className="ml-auto"><X size={14} /></button>
            </div>
          )}

          <button onClick={analyzeResume} disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-70 disabled:cursor-not-allowed">
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Target size={16} />}
            {loading ? "Analyzing..." : "Analyze ATS Fit"}
          </button>
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {!result && !loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 p-12 text-center"
              >
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-zinc-100 mb-4">
                  <Target size={28} className="text-zinc-300" />
                </div>
                <h3 className="text-sm font-bold text-zinc-600 mb-2">No Analysis Yet</h3>
                <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">Upload your resume, paste a job description, and click Analyze to see your ATS score and keyword gaps.</p>
              </motion.div>
            )}

            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center bg-zinc-50 rounded-2xl border border-zinc-200 p-12"
              >
                <div className="relative w-20 h-20 mb-6">
                  <div className="absolute inset-0 border-4 border-indigo-100 rounded-full" />
                  <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin" />
                  <Target size={24} className="absolute inset-0 m-auto text-indigo-500" />
                </div>
                <p className="text-sm font-bold text-zinc-700">Analyzing your resume...</p>
                <p className="text-xs text-zinc-400 mt-1">Extracting keywords & calculating ATS score</p>
              </motion.div>
            )}

            {result && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Score + Summary */}
                <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm">
                  <div className="flex items-center gap-6">
                    <ScoreGauge score={result.score} />
                    <div className="flex-1">
                      <h3 className="text-base font-black text-zinc-900 mb-1">
                        {result.score >= 75 ? "Strong Match" : result.score >= 50 ? "Moderate Match" : "Weak Match"}
                      </h3>
                      <p className="text-sm text-zinc-500 leading-relaxed">{result.summary}</p>
                      <div className="flex items-center gap-4 mt-3">
                        <div className="text-center">
                          <p className="text-lg font-black text-emerald-600">{result.matched.length}</p>
                          <p className="text-[10px] text-zinc-400 font-semibold">Matched</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-black text-red-500">{result.missing.length}</p>
                          <p className="text-[10px] text-zinc-400 font-semibold">Missing</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                  <div className="flex border-b border-zinc-100">
                    {(["keywords", "suggestions", "bullets"] as const).map(tab => (
                      <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-3 text-xs font-bold capitalize transition-colors ${activeTab === tab ? "text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50/50" : "text-zinc-500 hover:text-zinc-800"}`}>
                        {tab === "keywords" ? "Keywords" : tab === "suggestions" ? "Suggestions" : "Optimized Bullets"}
                      </button>
                    ))}
                  </div>
                  <div className="p-5">
                    <AnimatePresence mode="wait">
                      {activeTab === "keywords" && (
                        <motion.div key="keywords" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <div className="mb-4">
                            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                              <CheckCircle2 size={12} /> Matched Keywords ({result.matched.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {result.matched.map(k => <KeywordPill key={k} word={k} matched />)}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                              <AlertCircle size={12} /> Missing Keywords ({result.missing.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {result.missing.map(k => <KeywordPill key={k} word={k} matched={false} />)}
                            </div>
                            {result.missing.length > 0 && (
                              <p className="text-[11px] text-zinc-400 mt-3 flex items-center gap-1">
                                <Info size={11} /> Click any keyword to copy it. Add missing ones to your resume where relevant.
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                      {activeTab === "suggestions" && (
                        <motion.div key="suggestions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <div className="space-y-3">
                            {result.suggestions.map((s, i) => (
                              <div key={i} className="flex items-start gap-3 bg-zinc-50 rounded-xl p-3 border border-zinc-100">
                                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                                  {i + 1}
                                </div>
                                <p className="text-sm text-zinc-700 leading-relaxed">{s}</p>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                      {activeTab === "bullets" && (
                        <motion.div key="bullets" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs text-zinc-400">AI-optimized bullet points tailored to the JD</p>
                            <button onClick={copyBullets}
                              className={`text-xs font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${copied ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>
                              <Copy size={12} /> {copied ? "Copied!" : "Copy All"}
                            </button>
                          </div>
                          <div className="space-y-2">
                            {result.optimizedBullets.map((b, i) => (
                              <div key={i} className="flex items-start gap-2 bg-violet-50 rounded-xl p-3 border border-violet-100">
                                <Zap size={14} className="text-violet-500 shrink-0 mt-0.5" />
                                <p className="text-sm text-zinc-700 leading-relaxed">{b}</p>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Re-analyze */}
                <button onClick={analyzeResume}
                  className="w-full py-2.5 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-600 hover:bg-zinc-50 flex items-center justify-center gap-2 transition-colors">
                  <RefreshCw size={14} /> Re-analyze
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
