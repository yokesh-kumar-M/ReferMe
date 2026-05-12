"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/store/appStore";
import { useDashboardStore } from "@/store/dashboardStore";
import {
  Settings, Key, Database, Download, Upload, Trash2,
  CheckCircle2, Eye, EyeOff, Shield, Zap, AlertTriangle, Copy, X
} from "lucide-react";

function ApiKeyField({ label, value, onChange, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; hint?: string;
}) {
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
      <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wider mb-2">{label}</label>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type={show ? "text" : "password"}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2.5 pr-10 text-sm rounded-xl border border-zinc-200 bg-white focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-mono"
          />
          <button onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <button onClick={save} className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${saved ? "bg-emerald-500 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"}`}>
          {saved ? <CheckCircle2 size={16} /> : "Save"}
        </button>
      </div>
      {value && (
        <div className="flex items-center gap-1.5 mt-2">
          <CheckCircle2 size={12} className="text-emerald-500" />
          <span className="text-xs text-emerald-600 font-medium">Key configured</span>
        </div>
      )}
      {hint && <p className="text-xs text-zinc-400 mt-2">{hint}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const { groqApiKey, setGroqApiKey, geminiApiKey, setGeminiApiKey, resumeProfiles, clearHistory, history } = useAppStore();
  const { applications, contacts } = useDashboardStore();
  const [mounted, setMounted] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("anthropic_api_key") || "";
    setAnthropicKey(stored);
  }, []);

  if (!mounted) return null;

  const saveAnthropicKey = (key: string) => {
    setAnthropicKey(key);
    localStorage.setItem("anthropic_api_key", key);
    setSaved("anthropic");
    setTimeout(() => setSaved(null), 2000);
  };

  const exportData = () => {
    const data = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      applications,
      contacts,
      resumeProfiles,
      history,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jobright_backup_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.applications) {
          const { useDashboardStore: ds } = require("@/store/dashboardStore");
          // basic import — reset and re-add
          alert(`Import found ${data.applications.length} applications and ${data.contacts?.length || 0} contacts. Import feature will be fully implemented soon.`);
        }
      } catch {
        alert("Invalid backup file.");
      }
    };
    reader.readAsText(file);
  };

  const clearAllData = () => {
    if (confirm("Are you sure you want to delete ALL data? This cannot be undone.")) {
      if (confirm("Last chance — delete everything?")) {
        localStorage.removeItem("jobright-dashboard");
        localStorage.removeItem("referme-storage");
        window.location.reload();
      }
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-black text-zinc-900">Settings</h1>
        <p className="text-xs text-zinc-400 mt-0.5">Configure API keys, manage your data, and customize the dashboard.</p>
      </div>

      <div className="space-y-6">
        {/* API Keys */}
        <section className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 flex items-center gap-2">
            <Key size={18} className="text-indigo-500" />
            <h2 className="text-sm font-bold text-zinc-800">API Keys</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
              <Shield size={16} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 leading-relaxed">
                API keys are stored locally in your browser and never sent to any server. They're used directly for AI generation.
              </p>
            </div>

            <ApiKeyField
              label="Groq API Key (Recommended — Fast & Free)"
              value={groqApiKey}
              onChange={setGroqApiKey}
              placeholder="gsk_..."
              hint="Free tier available at console.groq.com — powers llama-3.3-70b-versatile"
            />
            <ApiKeyField
              label="Google Gemini API Key"
              value={geminiApiKey}
              onChange={setGeminiApiKey}
              placeholder="AIza..."
              hint="Free tier at aistudio.google.com — used as fallback when Groq fails"
            />

            <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
              <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wider mb-2">
                Anthropic (Claude) API Key — For Advanced AI
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="password"
                    value={anthropicKey}
                    onChange={e => saveAnthropicKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-zinc-200 bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none font-mono"
                  />
                </div>
                {saved === "anthropic" && <div className="px-4 py-2.5 bg-emerald-100 text-emerald-700 rounded-xl text-sm font-bold flex items-center"><CheckCircle2 size={16} /></div>}
              </div>
              {anthropicKey && (
                <div className="flex items-center gap-1.5 mt-2">
                  <CheckCircle2 size={12} className="text-emerald-500" />
                  <span className="text-xs text-emerald-600 font-medium">Claude configured — most advanced AI available</span>
                </div>
              )}
              <p className="text-xs text-zinc-400 mt-2">Get key at console.anthropic.com — enables claude-sonnet-4-6 for highest quality output</p>
            </div>
          </div>
        </section>

        {/* Data & Storage */}
        <section className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 flex items-center gap-2">
            <Database size={18} className="text-indigo-500" />
            <h2 className="text-sm font-bold text-zinc-800">Data & Storage</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: "Applications", value: applications.length },
                { label: "Contacts", value: contacts.length },
                { label: "Resume Profiles", value: resumeProfiles.length },
              ].map(({ label, value }) => (
                <div key={label} className="bg-zinc-50 rounded-xl p-4 text-center border border-zinc-100">
                  <p className="text-2xl font-black text-zinc-800">{value}</p>
                  <p className="text-xs text-zinc-500 font-medium mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={exportData}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition-colors">
                <Download size={16} /> Export Backup
              </button>
              <label className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer">
                <Upload size={16} /> Import Backup
                <input type="file" accept=".json" onChange={importData} className="hidden" />
              </label>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-red-100 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            <h2 className="text-sm font-bold text-red-800">Danger Zone</h2>
          </div>
          <div className="p-6 space-y-3">
            <button onClick={() => { if (confirm("Clear all generation history?")) clearHistory(); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-red-100 text-left hover:bg-red-50 transition-colors group">
              <Trash2 size={16} className="text-red-400 group-hover:text-red-600" />
              <div>
                <p className="text-sm font-bold text-red-700">Clear Generation History</p>
                <p className="text-xs text-red-400">Remove all {history.length} saved AI outputs</p>
              </div>
            </button>
            <button onClick={clearAllData}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-left hover:bg-red-100 transition-colors group">
              <Trash2 size={16} className="text-red-600" />
              <div>
                <p className="text-sm font-bold text-red-800">Delete ALL Data</p>
                <p className="text-xs text-red-500">Remove all applications, contacts, resume profiles, and history. Cannot be undone.</p>
              </div>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
