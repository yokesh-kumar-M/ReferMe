"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles, Wand2, Download, LayoutDashboard, ArrowRight,
  CheckCircle2, Zap, FileText, Mail, Target,
  Briefcase, Globe, Shield, Star, ChevronDown, Cpu
} from "lucide-react";

const PLATFORMS = [
  "LinkedIn", "Greenhouse", "Lever", "Workday", "Indeed",
  "Glassdoor", "SmartRecruiters", "Ashby", "iCIMS", "Rippling",
];

const FEATURES = [
  {
    icon: Zap,
    color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    title: "Instant Autofill",
    desc: "Detects job application forms on 10+ platforms and fills every field from your resume in one click — including cover letter boxes.",
  },
  {
    icon: Cpu,
    color: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    title: "AI Cover Letter",
    desc: "One button generates a tailored cover letter that matches the exact job description using your own AI key.",
  },
  {
    icon: Target,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    title: "ATS CV Optimizer",
    desc: "Upload your resume, paste a JD — get a keyword gap report and an AI-rewritten CV that passes ATS filters.",
  },
  {
    icon: FileText,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    title: "Smart Tracker",
    desc: "Save any job with one click from any site. Kanban board tracks every application through the full pipeline.",
  },
  {
    icon: Mail,
    color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    title: "Cold Outreach",
    desc: "Generate referral emails, cold outreach, LinkedIn notes, and follow-ups — all tailored to the role.",
  },
  {
    icon: Shield,
    color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
    title: "Your Keys, Your Data",
    desc: "100% local. API keys and resume data never leave your browser. Bring your own Groq or Gemini key.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Install the Extension",
    desc: "Add ReferMe Agent to Chrome. It takes 30 seconds.",
    color: "from-indigo-500 to-violet-500",
  },
  {
    step: "02",
    title: "Upload Your Resume",
    desc: "Paste your resume or upload a PDF in the extension or dashboard. Add your Groq/Gemini API key.",
    color: "from-violet-500 to-purple-500",
  },
  {
    step: "03",
    title: "Browse Jobs Normally",
    desc: "When you open any job page, ReferMe auto-detects it and shows your ATS match score.",
    color: "from-purple-500 to-pink-500",
  },
  {
    step: "04",
    title: "Apply in One Click",
    desc: "Click ✨ to open the AI panel. Autofill the form, generate a cover letter, and submit — all from the job page.",
    color: "from-pink-500 to-rose-500",
  },
];

const FAQ = [
  {
    q: "Is this free?",
    a: "Yes, 100% free and open-source. You only need a free Groq API key (or Gemini) for AI features.",
  },
  {
    q: "Does it work on all job sites?",
    a: "It works on LinkedIn, Greenhouse, Lever, Workday, Indeed, Glassdoor, SmartRecruiters, Ashby, iCIMS, Rippling, and any generic ATS form.",
  },
  {
    q: "Is my resume data safe?",
    a: "Your resume and API keys are stored only in your browser's local storage. Nothing is sent to any server we own.",
  },
  {
    q: "What AI models does it use?",
    a: "Groq (llama-3.3-70b-versatile) as primary for speed, Gemini 2.0 Flash as fallback. Both have generous free tiers.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-zinc-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-zinc-900/50 transition-colors"
      >
        <span className="text-sm font-bold text-zinc-200">{q}</span>
        <ChevronDown
          size={16}
          className={`text-zinc-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-6 pb-4 text-sm text-zinc-400 leading-relaxed border-t border-zinc-800/50">
          <p className="pt-3">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Ambient glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed top-1/2 left-1/4 w-[600px] h-[400px] bg-violet-600/8 rounded-full blur-[120px] pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-20 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto border-b border-zinc-800/60">
        <div className="flex items-center gap-2.5">
          <div className="bg-gradient-to-tr from-indigo-600 to-violet-500 p-2 rounded-xl text-white shadow-lg shadow-indigo-500/25">
            <Sparkles size={18} strokeWidth={2.5} />
          </div>
          <span className="text-lg font-black tracking-tight">ReferMe</span>
          <span className="hidden sm:block text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 px-2 py-0.5 rounded-full uppercase tracking-wider ml-1">
            Beta
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <button className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-xl hover:bg-zinc-800/60">
              <LayoutDashboard size={15} /> Dashboard
            </button>
          </Link>
          <Link href="/dashboard">
            <button className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-zinc-700/60 hover:border-indigo-500/40 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all">
              Get Started <ArrowRight size={14} />
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-20 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-8"
        >
          <Sparkles size={12} /> Your personal Jobright clone — open source
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-[1.05]"
        >
          Apply smarter.{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400">
            Land faster.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg md:text-xl text-zinc-400 max-w-2xl mb-10 leading-relaxed font-medium"
        >
          Chrome extension that detects job portals, autofills applications, tailors your
          resume, and writes a cover letter — all powered by your own AI key.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-3 items-center"
        >
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-2xl blur opacity-50 group-hover:opacity-80 transition duration-300" />
            <a
              href="https://github.com/yokesh-kumar-M/ReferMe/releases/latest"
              target="_blank"
              rel="noreferrer"
              className="relative flex items-center gap-2 bg-[#09090b] border border-zinc-700 text-white px-7 py-3.5 rounded-2xl text-base font-bold transition-all hover:scale-[0.98]"
            >
              <Download size={18} /> Download Extension
            </a>
          </div>
          <Link href="/dashboard">
            <button className="flex items-center gap-2 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 px-7 py-3.5 rounded-2xl text-base font-semibold transition-all">
              Open Dashboard <ArrowRight size={16} />
            </button>
          </Link>
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-6 mt-10 text-xs text-zinc-500 font-medium flex-wrap justify-center"
        >
          {["Free & open source", "No account needed", "Your keys, your data", "10+ job boards"].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-emerald-500" /> {t}
            </span>
          ))}
        </motion.div>
      </main>

      {/* Platforms strip */}
      <div className="relative z-10 border-y border-zinc-800/60 py-5 bg-zinc-900/30 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-xs font-bold text-zinc-600 uppercase tracking-widest mb-4">
            Works on every major job board
          </p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2">
            {PLATFORMS.map((p) => (
              <span key={p} className="text-sm font-semibold text-zinc-500 hover:text-zinc-300 transition-colors">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Features grid */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">Features</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">
            Everything you need to land the job
          </h2>
          <p className="text-zinc-400 mt-3 max-w-xl mx-auto text-base">
            One extension. Zero subscriptions. All the tools Jobright charges $30/month for.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, color, title, desc }) => (
            <motion.div
              key={title}
              whileHover={{ y: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6 hover:border-zinc-700/80 transition-colors group"
            >
              <div className={`w-11 h-11 rounded-xl border flex items-center justify-center mb-4 ${color}`}>
                <Icon size={20} strokeWidth={2} />
              </div>
              <h3 className="text-base font-bold text-zinc-100 mb-2">{title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20 border-t border-zinc-800/60">
        <div className="text-center mb-16">
          <p className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-3">How It Works</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">
            From install to offer in four steps
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {HOW_IT_WORKS.map(({ step, title, desc, color }) => (
            <motion.div
              key={step}
              whileHover={{ scale: 1.02 }}
              className="relative bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6"
            >
              <div className={`text-4xl font-black bg-gradient-to-br ${color} bg-clip-text text-transparent mb-4 leading-none`}>
                {step}
              </div>
              <h3 className="text-base font-bold text-zinc-100 mb-2">{title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Bento showcase */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20 border-t border-zinc-800/60">
        <div className="text-center mb-12">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3">Dashboard</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">
            A full job search command center
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Wide card */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            className="md:col-span-2 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-7 relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/8 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10">
              <div className="w-11 h-11 bg-indigo-500/15 text-indigo-400 rounded-xl flex items-center justify-center mb-5 border border-indigo-500/20">
                <Wand2 size={20} />
              </div>
              <h3 className="text-xl font-bold mb-2">One-Click Autofill Engine</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Extension detects Workday, Lever, Greenhouse, and 7+ more ATS forms instantly. Maps your
                resume fields — first name, email, phone, LinkedIn, summary — and fires them all in one click.
                Unknown questions get flagged for you to answer once and remember forever.
              </p>
            </div>
          </motion.div>

          {/* Tall card */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            className="md:row-span-2 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-7 relative overflow-hidden group flex flex-col"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/8 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10 flex-1 flex flex-col">
              <div className="w-11 h-11 bg-violet-500/15 text-violet-400 rounded-xl flex items-center justify-center mb-5 border border-violet-500/20">
                <Download size={20} />
              </div>
              <h3 className="text-xl font-bold mb-2">Tailored CV Generator</h3>
              <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                AI rewrites your resume to match the exact keywords in any job description — then exports a
                clean, ATS-ready PDF.
              </p>
              {/* Mock resume preview */}
              <div className="flex-1 bg-zinc-950 rounded-xl border border-zinc-800 p-5 flex flex-col gap-3">
                <div className="w-2/3 h-2.5 bg-zinc-700 rounded-full" />
                <div className="w-full h-1.5 bg-zinc-800 rounded-full" />
                <div className="w-5/6 h-1.5 bg-zinc-800 rounded-full" />
                <div className="w-4/6 h-1.5 bg-zinc-800 rounded-full mb-2" />
                <div className="w-1/2 h-2.5 bg-zinc-700 rounded-full" />
                <div className="w-full h-1.5 bg-zinc-800 rounded-full" />
                <div className="w-full h-1.5 bg-zinc-800 rounded-full" />
                <div className="w-3/4 h-1.5 bg-zinc-800 rounded-full" />
                <div className="mt-1 flex gap-1.5">
                  <div className="h-5 w-14 bg-indigo-500/30 border border-indigo-500/40 rounded text-[9px] flex items-center justify-center text-indigo-300 font-bold">React</div>
                  <div className="h-5 w-14 bg-indigo-500/30 border border-indigo-500/40 rounded text-[9px] flex items-center justify-center text-indigo-300 font-bold">Python</div>
                  <div className="h-5 w-14 bg-violet-500/30 border border-violet-500/40 rounded text-[9px] flex items-center justify-center text-violet-300 font-bold">AWS</div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Square card */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-7 relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/8 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10">
              <div className="w-11 h-11 bg-emerald-500/15 text-emerald-400 rounded-xl flex items-center justify-center mb-5 border border-emerald-500/20">
                <LayoutDashboard size={20} />
              </div>
              <h3 className="text-xl font-bold mb-2">Kanban Job Tracker</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Save jobs from any site with one click. Track every application from Saved → Applied → Interview → Offer.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-20 border-t border-zinc-800/60">
        <div className="text-center mb-12">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3">FAQ</p>
          <h2 className="text-3xl font-black tracking-tight">Common questions</h2>
        </div>
        <div className="space-y-3">
          {FAQ.map((item) => (
            <FaqItem key={item.q} {...item} />
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24 border-t border-zinc-800/60">
        <div className="bg-gradient-to-br from-indigo-600/20 to-violet-600/10 border border-indigo-500/20 rounded-3xl p-12 md:p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent" />
          <div className="relative z-10">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Star size={16} className="text-amber-400 fill-amber-400" />
              <Star size={16} className="text-amber-400 fill-amber-400" />
              <Star size={16} className="text-amber-400 fill-amber-400" />
              <Star size={16} className="text-amber-400 fill-amber-400" />
              <Star size={16} className="text-amber-400 fill-amber-400" />
            </div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4">
              Stop wasting time on forms.
            </h2>
            <p className="text-zinc-400 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
              Install ReferMe, add your resume once, and let AI handle the rest — cover letters, autofill, CV
              tailoring, and tracking.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-2xl blur opacity-60 group-hover:opacity-90 transition duration-300" />
                <a
                  href="https://github.com/yokesh-kumar-M/ReferMe/releases/latest"
                  target="_blank"
                  rel="noreferrer"
                  className="relative flex items-center gap-2 bg-[#09090b] border border-zinc-700 text-white px-8 py-4 rounded-2xl text-base font-bold transition-all hover:scale-[0.98]"
                >
                  <Download size={18} /> Download Extension
                </a>
              </div>
              <Link href="/dashboard">
                <button className="flex items-center gap-2 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white px-8 py-4 rounded-2xl text-base font-semibold transition-all">
                  <Briefcase size={18} /> Open Dashboard
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-800/60 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-indigo-600 to-violet-500 p-1.5 rounded-lg text-white">
              <Sparkles size={12} strokeWidth={2.5} />
            </div>
            <span className="font-bold text-zinc-500">ReferMe</span>
            <span>— Open source job application agent</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="https://github.com/yokesh-kumar-M/ReferMe" target="_blank" rel="noreferrer" className="hover:text-zinc-400 transition-colors flex items-center gap-1">
              <Globe size={12} /> GitHub
            </a>
            <a href="https://github.com/yokesh-kumar-M/ReferMe/releases/latest" target="_blank" rel="noreferrer" className="hover:text-zinc-400 transition-colors flex items-center gap-1">
              <Download size={12} /> Releases
            </a>
            <Link href="/dashboard" className="hover:text-zinc-400 transition-colors">Dashboard</Link>
            <Link href="/dashboard/settings" className="hover:text-zinc-400 transition-colors">Settings</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
