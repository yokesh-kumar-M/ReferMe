"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sparkles, Wand2, Download, LayoutDashboard, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans selection:bg-indigo-500/30 overflow-hidden relative">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-3/4 left-1/4 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-tr from-indigo-600 to-violet-500 p-2 rounded-xl text-white shadow-lg shadow-indigo-500/20">
            <Sparkles size={20} strokeWidth={2.5} />
          </div>
          <span className="text-xl font-black tracking-tight">ReferMe</span>
        </div>
        <button className="text-sm font-bold text-zinc-300 hover:text-white transition-colors">
          Sign In
        </button>
      </nav>

      {/* Hero */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-8 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
        >
          <Sparkles size={14} /> Meet your new career agent
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-tight"
        >
          Let AI <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Apply For You.</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg md:text-xl text-zinc-400 max-w-2xl mb-10 leading-relaxed font-medium"
        >
          The first autonomous browser agent that detects job portals, tailors your resume, and auto-fills applications—all with zero latency.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="relative group"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-2xl blur opacity-40 group-hover:opacity-70 transition duration-500" />
          <button className="relative flex items-center gap-2 bg-[#09090b] border border-zinc-800 hover:border-indigo-500/50 text-white px-8 py-4 rounded-2xl text-lg font-bold transition-all hover:scale-[0.98] active:scale-[0.95]">
            Install Extension <ArrowRight size={20} />
          </button>
        </motion.div>

        {/* Bento Grid */}
        <div className="w-full mt-32 grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-6">
          
          {/* Card 1: Autofill Engine (Wide) */}
          <motion.div 
            whileHover={{ scale: 1.02, rotate: -1 }}
            className="md:col-span-2 bg-zinc-900/50 backdrop-blur-sm border border-zinc-800/50 rounded-3xl p-8 relative overflow-hidden group shadow-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10 h-full flex flex-col justify-between">
              <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center mb-6 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                <Wand2 size={24} />
              </div>
              <div className="text-left">
                <h3 className="text-2xl font-bold mb-2">The Autofill Engine</h3>
                <p className="text-zinc-400 font-medium text-lg">Instantly maps your extracted resume JSON to Workday, Lever, and Greenhouse forms with superhuman speed.</p>
              </div>
            </div>
          </motion.div>

          {/* Card 2: PDF Generator (Tall) */}
          <motion.div 
            whileHover={{ scale: 1.02, rotate: 1 }}
            className="md:row-span-2 bg-zinc-900/50 backdrop-blur-sm border border-zinc-800/50 rounded-3xl p-8 relative overflow-hidden group flex flex-col shadow-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10 flex-1 flex flex-col">
              <div className="w-12 h-12 bg-violet-500/20 text-violet-400 rounded-xl flex items-center justify-center mb-6 border border-violet-500/20 shadow-[0_0_15px_rgba(139,92,246,0.2)]">
                <Download size={24} />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-2xl font-bold mb-2">Resume PDF Generator</h3>
                <p className="text-zinc-400 font-medium mb-8">Tailors your Markdown CV to the exact job description and renders a clean, professional PDF on the fly.</p>
              </div>
              <div className="w-full aspect-[3/4] bg-zinc-950 rounded-xl border border-zinc-800 p-6 shadow-2xl relative flex flex-col gap-4">
                 <div className="w-3/4 h-3 bg-zinc-800 rounded" />
                 <div className="w-full h-1.5 bg-zinc-800 rounded" />
                 <div className="w-5/6 h-1.5 bg-zinc-800 rounded" />
                 <div className="w-4/6 h-1.5 bg-zinc-800 rounded mb-4" />
                 <div className="w-1/2 h-3 bg-zinc-800 rounded" />
                 <div className="w-full h-1.5 bg-zinc-800 rounded" />
                 <div className="w-full h-1.5 bg-zinc-800 rounded" />
              </div>
            </div>
          </motion.div>

          {/* Card 3: Mini-CRM (Square) */}
          <motion.div 
            whileHover={{ scale: 1.02, rotate: -1 }}
            className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800/50 rounded-3xl p-8 relative overflow-hidden group shadow-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10 h-full flex flex-col justify-between">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center mb-6 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <LayoutDashboard size={24} />
              </div>
              <div className="text-left">
                <h3 className="text-2xl font-bold mb-2">Visual Mini-CRM</h3>
                <p className="text-zinc-400 font-medium">Built-in Kanban board tracking every job you interact with automatically.</p>
              </div>
            </div>
          </motion.div>

        </div>
      </main>
    </div>
  );
}
