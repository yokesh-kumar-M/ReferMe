"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/store/appStore";
import { useDashboardStore } from "@/store/dashboardStore";
import { sanitizeText, extractRelevantResumeContext, renderMarkdown } from "@/lib/utils";
import {
  Sparkles, Send, Copy, CheckCircle2, Download, Mail,
  FileText, Briefcase, MessageSquare, ChevronDown, Wand2,
  X, AlertCircle, BookOpen, Mic, ThumbsUp, RefreshCw, Zap
} from "lucide-react";

type GenType = "cover_letter" | "referral" | "cold_mail" | "linkedin" | "custom_cv"
  | "match_analyzer" | "interview_prep" | "thank_you" | "follow_up";

const GEN_CONFIG: Record<GenType, { label: string; icon: React.ElementType; color: string; desc: string }> = {
  cover_letter: { label: "Cover Letter", icon: FileText, color: "text-indigo-600 bg-indigo-50", desc: "Tailored cover letter for a specific job" },
  custom_cv: { label: "Tailored CV", icon: Wand2, color: "text-violet-600 bg-violet-50", desc: "Rewrite resume to match job keywords" },
  match_analyzer: { label: "ATS Analysis", icon: Zap, color: "text-amber-600 bg-amber-50", desc: "Detailed ATS score and keyword report" },
  referral: { label: "Referral Request", icon: MessageSquare, color: "text-blue-600 bg-blue-50", desc: "Ask someone for an employee referral" },
  cold_mail: { label: "Cold Outreach", icon: Mail, color: "text-teal-600 bg-teal-50", desc: "Cold email to recruiter or hiring manager" },
  linkedin: { label: "LinkedIn Note", icon: Briefcase, color: "text-sky-600 bg-sky-50", desc: "Short connection request note" },
  interview_prep: { label: "Interview Prep", icon: Mic, color: "text-rose-600 bg-rose-50", desc: "AI-generated questions & model answers" },
  thank_you: { label: "Thank You Note", icon: ThumbsUp, color: "text-emerald-600 bg-emerald-50", desc: "Post-interview thank you email" },
  follow_up: { label: "Follow-Up Email", icon: RefreshCw, color: "text-orange-600 bg-orange-50", desc: "Follow up on submitted application" },
};

const SYSTEM_PROMPTS: Record<GenType, string> = {
  cover_letter: `You are an expert career coach writing a highly compelling, professional cover letter. Match the applicant's resume skills strictly to the job description. Keep it to 3 concise, engaging paragraphs. Show confidence but be authentic. Do not make up experience.`,
  custom_cv: `You are an elite executive resume writer. Rewrite the applicant's resume to PERFECTLY match the job description.
CRITICAL INSTRUCTIONS:
1. DO NOT invent or hallucinate experience. Only reframe, reorder, and highlight existing experience.
2. Use ATS-friendly, professional Markdown formatting.
3. Include: powerful Professional Summary, Core Competencies matching JD keywords, tailored Experience bullets (quantified), Education.
4. Output ONLY clean Markdown. No conversational filler.`,
  match_analyzer: `You are an expert ATS algorithm. Evaluate the candidate's resume against the job description. Output a detailed ATS Match Analysis in Markdown.
1. Start with a prominent Match Score (e.g., **Match Score: 85/100**).
2. List 'Matched Skills': strengths that align.
3. List 'Missing/Weak Skills': gaps.
4. Conclude with 'Actionable Advice': 3 specific suggestions.`,
  referral: `You are writing a highly effective referral request to an employee at the target company.
Use the applicant's top 1-2 accomplishments that directly map to the job's top requirements.
Keep it under 150 words. Include Subject: [line].
Direct hook, value proposition, low-friction call to action. No clichés.`,
  cold_mail: `You are writing a highly effective cold outreach email to a hiring manager or recruiter.
Highlight only the top 1-2 accomplishments that directly map to the job's top requirements.
Keep it under 150 words. Include Subject: [line].
Direct, shows value, ends with a specific low-friction CTA (e.g., "10-minute chat this week?").`,
  linkedin: `You are writing a LinkedIn connection request note (strictly under 300 characters total).
Brief, polite, action-oriented. Ask for referral or brief chat.`,
  interview_prep: `You are an expert interview coach. Based on the job description and the candidate's resume, generate:
1. **Top 8 Interview Questions** likely to be asked (mix behavioral, technical, situational)
2. For each question, provide a **Model Answer** using the STAR method where applicable, tailored to the candidate's actual experience.
Format in clear Markdown with ## headers for each question.`,
  thank_you: `You are writing a professional, warm post-interview thank you email.
Reference a specific topic from the "interview" context if provided, or write a general version.
Keep it under 120 words. Include Subject: [line].
Express genuine enthusiasm for the role and company. Reiterate one key strength.`,
  follow_up: `You are writing a professional follow-up email for a submitted job application.
Keep it under 100 words. Include Subject: [line].
Reference the specific role, express continued interest, offer to provide more information. Polite, not pushy.`,
};

export default function AIToolkitPage() {
  const { groqApiKey, geminiApiKey, getActiveResume, history, addHistoryEntry } = useAppStore();
  const { applications } = useDashboardStore();
  const [mounted, setMounted] = useState(false);

  const [genType, setGenType] = useState<GenType>("cover_letter");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [recruiterEmail, setRecruiterEmail] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const hasKey = groqApiKey || geminiApiKey;
  const activeResume = getActiveResume();
  const cfg = GEN_CONFIG[genType];

  const loadFromTracker = (jobId: string) => {
    const app = applications.find(a => a.id === jobId);
    if (app) { setJobDescription(app.jobDescription); setJobTitle(app.jobTitle); }
  };

  const generate = async () => {
    if (!activeResume) { setError("Upload your resume in the ATS Optimizer first."); return; }
    if (!jobDescription && !["thank_you", "follow_up"].includes(genType)) { setError("Please paste a job description."); return; }
    if (!hasKey) { setError("Add an API key in Settings."); return; }

    setLoading(true);
    setError("");
    setResult("");

    const systemPrompt = SYSTEM_PROMPTS[genType];
    const sanitized = sanitizeText(jobDescription);
    const relevantResume = ["custom_cv", "match_analyzer", "interview_prep"].includes(genType)
      ? activeResume
      : extractRelevantResumeContext(activeResume, sanitized);

    const userPrompt = `JOB TITLE: ${sanitizeText(jobTitle || "the position")}
JOB DESCRIPTION:
${sanitized || "N/A"}

APPLICANT RESUME:
${relevantResume}
${recruiterEmail ? `\nTARGET EMAIL: ${recruiterEmail}` : ""}
${extraContext ? `\nADDITIONAL CONTEXT: ${sanitizeText(extraContext)}` : ""}

Generate the ${GEN_CONFIG[genType].label}. Return only the final output, ready to use.`;

    try {
      let currentText = "";
      setLoading(false);

      if (groqApiKey) {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqApiKey}` },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            temperature: 0.6, stream: true
          })
        });
        if (!res.ok) throw new Error(`Groq error ${res.status}`);
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No stream");
        const decoder = new TextDecoder();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const content = JSON.parse(line.slice(6)).choices?.[0]?.delta?.content;
                if (content) { currentText += content; setResult(currentText); }
              } catch { /* skip */ }
            }
          }
        }
      } else if (geminiApiKey) {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${geminiApiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.6 }
          })
        });
        if (!res.ok) throw new Error(`Gemini error ${res.status}`);
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { value, done } = await reader!.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const matches = [...buffer.matchAll(/"text"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g)];
          for (const match of matches) {
            try { const piece = JSON.parse(`"${match[1]}"`); currentText += piece; setResult(currentText); } catch { /* skip */ }
          }
          if (matches.length > 0) buffer = buffer.slice((matches[matches.length - 1].index || 0) + matches[matches.length - 1][0].length);
        }
      }

      if (currentText) {
        addHistoryEntry({ type: genType, jobTitle: jobTitle || "Untitled", result: currentText });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const el = document.querySelector(".ai-markdown-output");
      if (!el) return;
      const wrapper = document.createElement("div");
      wrapper.innerHTML = el.innerHTML;
      wrapper.style.cssText = "padding:20px;font-family:Arial,sans-serif;color:#000";
      html2pdf().set({ margin: 10, filename: `${GEN_CONFIG[genType].label}_${jobTitle || "output"}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: "mm", format: "a4" } }).from(wrapper).save();
    } catch { setError("PDF export failed."); }
  };

  const openGmail = () => {
    const subjectMatch = result.match(/^Subject:\s*(.+)$/m);
    const subject = subjectMatch ? subjectMatch[1].trim() : `${GEN_CONFIG[genType].label} - ${jobTitle}`;
    const body = result.replace(/^Subject:\s*(.+)$/m, "").trim();
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recruiterEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
  };

  const isMarkdown = ["custom_cv", "match_analyzer", "interview_prep"].includes(genType);
  const isEmail = ["cold_mail", "referral", "thank_you", "follow_up", "cover_letter"].includes(genType);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-black text-zinc-900">AI Toolkit</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Generate tailored content for every step of your job search.</p>
        </div>
        <button onClick={() => setShowHistory(!showHistory)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-colors ${showHistory ? "bg-violet-100 text-violet-700" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
          <BookOpen size={16} /> History ({history.length})
        </button>
      </div>

      {/* History Panel */}
      <AnimatePresence>
        {showHistory && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-6">
            <div className="bg-white rounded-2xl border border-violet-100 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-zinc-800 mb-3">Generation History</h3>
              {history.length === 0 ? (
                <p className="text-xs text-zinc-400 text-center py-4">No history yet.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {history.map(h => (
                    <div key={h.id} className="flex items-center gap-3 bg-zinc-50 rounded-xl p-3 border border-zinc-100 group">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-zinc-700 truncate">{h.jobTitle}</p>
                        <p className="text-[10px] text-zinc-400 truncate">{h.result.slice(0, 80)}...</p>
                      </div>
                      <button onClick={() => { setResult(h.result); setShowHistory(false); }}
                        className="text-xs bg-violet-100 text-violet-700 px-2.5 py-1 rounded-lg font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Controls */}
        <div className="lg:col-span-2 space-y-4">
          {/* Gen Type Selector */}
          <div className="bg-white rounded-2xl p-4 border border-zinc-200/80 shadow-sm">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">What to Generate</p>
            <div className="grid grid-cols-1 gap-1.5">
              {(Object.keys(GEN_CONFIG) as GenType[]).map(type => {
                const c = GEN_CONFIG[type];
                const Icon = c.icon;
                return (
                  <button key={type} onClick={() => setGenType(type)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${genType === type ? "bg-indigo-50 border border-indigo-200 shadow-sm" : "hover:bg-zinc-50 border border-transparent"}`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${c.color}`}>
                      <Icon size={14} />
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${genType === type ? "text-indigo-700" : "text-zinc-700"}`}>{c.label}</p>
                      <p className="text-[10px] text-zinc-400 leading-tight">{c.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Job Details */}
          <div className="bg-white rounded-2xl p-4 border border-zinc-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Job Details</p>
              {applications.filter(a => a.jobDescription).length > 0 && (
                <select onChange={e => e.target.value && loadFromTracker(e.target.value)}
                  className="text-[10px] font-bold text-indigo-600 border border-indigo-200 rounded-lg px-2 py-1 bg-indigo-50 outline-none cursor-pointer">
                  <option value="">Load from Tracker</option>
                  {applications.filter(a => a.jobDescription).map(a => (
                    <option key={a.id} value={a.id}>{a.jobTitle} @ {a.company}</option>
                  ))}
                </select>
              )}
            </div>
            <input value={jobTitle} onChange={e => setJobTitle(e.target.value)}
              placeholder="Job Title & Company"
              className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 outline-none mb-2 transition-all" />
            <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)}
              rows={5} placeholder="Paste job description..."
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 outline-none resize-none transition-all" />
          </div>

          {/* Extra Context */}
          {["cold_mail", "referral", "linkedin", "thank_you", "follow_up"].includes(genType) && (
            <div className="bg-white rounded-2xl p-4 border border-zinc-200/80 shadow-sm">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Recruiter Email (optional)</p>
              <input value={recruiterEmail} onChange={e => setRecruiterEmail(e.target.value)}
                placeholder="recruiter@company.com"
                className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 outline-none transition-all" />
            </div>
          )}

          {["interview_prep", "thank_you"].includes(genType) && (
            <div className="bg-white rounded-2xl p-4 border border-zinc-200/80 shadow-sm">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Extra Context</p>
              <textarea value={extraContext} onChange={e => setExtraContext(e.target.value)}
                rows={3} placeholder={genType === "interview_prep" ? "Specific topics or areas to focus on..." : "Topics discussed in interview..."}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 outline-none resize-none transition-all" />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 rounded-xl p-3 text-sm">
              <AlertCircle size={16} className="shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError("")}><X size={14} /></button>
            </div>
          )}

          <button onClick={generate} disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-70">
            {loading ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><Sparkles size={16} /></motion.div> : <Send size={16} />}
            {loading ? "Generating..." : `Generate ${GEN_CONFIG[genType].label}`}
          </button>
        </div>

        {/* Right: Result */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-zinc-100 bg-indigo-50/30">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cfg.color}`}>
                      <cfg.icon size={14} />
                    </div>
                    <span className="text-sm font-bold text-zinc-800">{cfg.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEmail && (
                      <button onClick={openGmail}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50 font-bold flex items-center gap-1.5 transition-colors">
                        <Mail size={12} /> Gmail
                      </button>
                    )}
                    {isMarkdown && (
                      <button onClick={downloadPDF}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50 font-bold flex items-center gap-1.5 transition-colors">
                        <Download size={12} /> PDF
                      </button>
                    )}
                    <button onClick={() => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      className={`text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${copied ? "bg-emerald-500 text-white" : "bg-zinc-900 text-white hover:bg-black"}`}>
                      {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />} {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
                <div className="p-6 overflow-y-auto max-h-[600px]">
                  {isMarkdown ? (
                    <div className="ai-markdown-output text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(result) }} />
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm text-zinc-700 leading-relaxed font-sans">{result}</pre>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center p-16 text-center min-h-[400px]">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${cfg.color}`}>
                  <cfg.icon size={24} />
                </div>
                <h3 className="text-sm font-bold text-zinc-700 mb-2">{cfg.label}</h3>
                <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">{cfg.desc}. Fill in the details and click Generate.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
