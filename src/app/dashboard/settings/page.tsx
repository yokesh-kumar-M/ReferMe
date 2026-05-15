"use client";

// Settings: API keys (per-provider + primary selection), personal info
// for autofill, data export / import / wipe.

import React, { useEffect, useMemo, useState } from "react";
import {
  Key, Database, Download, Upload, Trash2, CheckCircle2, Eye, EyeOff,
  Shield, AlertTriangle, User, Sparkles,
} from "lucide-react";

import { useKeysStore, hasAnyKey } from "@/store/keysStore";
import { useProfileStore } from "@/store/profileStore";
import { useTrackerStore } from "@/store/trackerStore";
import { useHistoryStore } from "@/store/historyStore";
import { DEFAULT_MODELS } from "@/types";
import type { AIProvider } from "@/types";
import { Button, Input, Card, CardHeader, CardBody } from "@/components/ui";

const PROVIDERS: { id: AIProvider; label: string; doc: string; hint: string }[] = [
  { id: "groq", label: "Groq", doc: "https://console.groq.com/keys", hint: "Fast Llama 3.3 70B — free tier" },
  { id: "gemini", label: "Gemini", doc: "https://aistudio.google.com/app/apikey", hint: "Gemini 2.0 Flash — free tier" },
  { id: "mistral", label: "Mistral", doc: "https://console.mistral.ai/api-keys/", hint: "Optional — used as fallback" },
];

function ApiKeyField({
  provider,
  value,
  model,
  onValue,
  onModel,
  doc,
  hint,
}: {
  provider: AIProvider;
  value: string;
  model: string;
  onValue: (v: string) => void;
  onModel: (v: string) => void;
  doc: string;
  hint: string;
}) {
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200 space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
          {provider.toUpperCase()} API Key
        </label>
        <a
          href={doc}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] font-bold text-indigo-600 hover:underline"
        >
          Get key →
        </a>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => {
              onValue(e.target.value);
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
            }}
            placeholder={provider === "groq" ? "gsk_..." : provider === "gemini" ? "AIza..." : "sk_..."}
            className="w-full px-3 py-2.5 pr-10 text-sm rounded-xl border border-zinc-200 bg-white font-mono focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
          />
          <button
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <div
          className={
            "px-3 py-2.5 rounded-xl text-xs font-bold flex items-center transition-colors " +
            (value
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-zinc-100 text-zinc-400")
          }
        >
          {value ? (saved ? <CheckCircle2 className="w-4 h-4" /> : "Saved") : "Empty"}
        </div>
      </div>
      <Input
        fieldVariant="compact"
        label="Model"
        value={model}
        onChange={(e) => onModel(e.target.value)}
        placeholder={DEFAULT_MODELS[provider]}
      />
      <p className="text-[11px] text-zinc-500">{hint}</p>
    </div>
  );
}

export default function SettingsPage() {
  const keys = useKeysStore();
  const profile = useProfileStore();
  const tracker = useTrackerStore();
  const history = useHistoryStore();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  function exportAll() {
    const data = {
      version: 2,
      exportedAt: new Date().toISOString(),
      keys: keys.keys,
      profile: profile.profile,
      customAnswers: profile.customAnswers,
      resumes: profile.resumes,
      activeResumeId: profile.activeResumeId,
      applications: tracker.applications,
      contacts: tracker.contacts,
      history: history.entries,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `referme_backup_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importAll(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.resumes) {
        const existing = new Set(profile.resumes.map((r) => r.id));
        const merged = [
          ...profile.resumes,
          ...data.resumes.filter((r: { id: string }) => !existing.has(r.id)),
        ];
        useProfileStore.setState({ resumes: merged });
      }
      if (data.profile) profile.setProfile(data.profile);
      if (data.customAnswers) profile.setCustomAnswers(data.customAnswers);

      if (data.applications) {
        const existing = new Set(tracker.applications.map((a) => a.id));
        useTrackerStore.setState({
          applications: [
            ...tracker.applications,
            ...data.applications.filter((a: { id: string }) => !existing.has(a.id)),
          ],
        });
      }
      if (data.contacts) {
        const existing = new Set(tracker.contacts.map((c) => c.id));
        useTrackerStore.setState({
          contacts: [
            ...tracker.contacts,
            ...data.contacts.filter((c: { id: string }) => !existing.has(c.id)),
          ],
        });
      }
      alert("Backup imported. Reloading to refresh state.");
      window.location.reload();
    } catch {
      alert("Invalid backup file.");
    }
  }

  function wipeAll() {
    if (!confirm("Delete ALL data on this device? This cannot be undone.")) return;
    if (!confirm("Last chance — really wipe everything?")) return;
    try {
      const names = ["referme/keys", "referme/profile", "referme/tracker", "referme/history", "referme/onboarded"];
      names.forEach((n) => {
        try { window.localStorage.removeItem(n); } catch {}
      });
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.remove(names);
      }
    } finally {
      window.location.reload();
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-black text-zinc-900">Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Manage your API keys, personal info, resume profiles, and backup data.
        </p>
      </header>

      <div className="space-y-5">
        {/* API Keys */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-bold text-zinc-800">AI Provider Keys</span>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2 text-xs text-blue-700 leading-relaxed">
              <Shield className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <span>
                Keys never leave your browser. They&apos;re used directly when ReferMe
                calls the provider. ReferMe has no server.
              </span>
            </div>

            <label className="block">
              <span className="block text-[11px] uppercase tracking-wider font-bold text-zinc-500 mb-1.5">
                Primary provider
              </span>
              <select
                value={keys.primary}
                onChange={(e) => keys.setPrimary(e.target.value as AIProvider)}
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-zinc-500 mt-1.5">
                ReferMe tries this provider first; falls back to the others on error.
              </p>
            </label>

            {PROVIDERS.map((p) => (
              <ApiKeyField
                key={p.id}
                provider={p.id}
                value={keys.keys[p.id]}
                model={keys.models[p.id]}
                onValue={(v) => keys.setKey(p.id, v)}
                onModel={(v) => keys.setModel(p.id, v)}
                doc={p.doc}
                hint={p.hint}
              />
            ))}
          </CardBody>
        </Card>

        {/* Personal info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-bold text-zinc-800">Autofill profile</span>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="text-xs text-zinc-500">
              These fields feed the in-page autofill. The AI also writes here when it
              extracts your info from your resume on first use.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First name"
                value={profile.profile.firstName}
                onChange={(e) => profile.setProfileField("firstName", e.target.value)}
              />
              <Input
                label="Last name"
                value={profile.profile.lastName}
                onChange={(e) => profile.setProfileField("lastName", e.target.value)}
              />
              <Input
                label="Email"
                value={profile.profile.email}
                onChange={(e) => profile.setProfileField("email", e.target.value)}
              />
              <Input
                label="Phone"
                value={profile.profile.phone}
                onChange={(e) => profile.setProfileField("phone", e.target.value)}
              />
              <Input
                label="LinkedIn"
                value={profile.profile.linkedin}
                onChange={(e) => profile.setProfileField("linkedin", e.target.value)}
              />
              <Input
                label="GitHub"
                value={profile.profile.github}
                onChange={(e) => profile.setProfileField("github", e.target.value)}
              />
              <Input
                label="Website / portfolio"
                value={profile.profile.website}
                onChange={(e) => profile.setProfileField("website", e.target.value)}
              />
              <Input
                label="City"
                value={profile.profile.city}
                onChange={(e) => profile.setProfileField("city", e.target.value)}
              />
              <Input
                label="State / Region"
                value={profile.profile.state}
                onChange={(e) => profile.setProfileField("state", e.target.value)}
              />
              <Input
                label="Country"
                value={profile.profile.country}
                onChange={(e) => profile.setProfileField("country", e.target.value)}
              />
              <Input
                label="Years of experience"
                value={profile.profile.yearsOfExperience}
                onChange={(e) => profile.setProfileField("yearsOfExperience", e.target.value)}
              />
              <Input
                label="Expected salary"
                value={profile.profile.expectedSalary}
                onChange={(e) => profile.setProfileField("expectedSalary", e.target.value)}
              />
            </div>
            <div className="flex items-center gap-5 pt-1">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700">
                <input
                  type="checkbox"
                  checked={profile.profile.workAuthorized}
                  onChange={(e) => profile.setProfileField("workAuthorized", e.target.checked)}
                />
                Authorized to work
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700">
                <input
                  type="checkbox"
                  checked={profile.profile.needsSponsorship}
                  onChange={(e) => profile.setProfileField("needsSponsorship", e.target.checked)}
                />
                Requires sponsorship
              </label>
            </div>
          </CardBody>
        </Card>

        {/* Data */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-bold text-zinc-800">Data &amp; Backup</span>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "Applications", value: tracker.applications.length },
                { label: "Contacts", value: tracker.contacts.length },
                { label: "Resumes", value: profile.resumes.length },
              ].map(({ label, value }) => (
                <div key={label} className="bg-zinc-50 rounded-xl p-3 text-center border border-zinc-100">
                  <p className="text-xl font-black text-zinc-800">{value}</p>
                  <p className="text-[11px] text-zinc-500 font-semibold mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" icon={<Download className="w-4 h-4" />} onClick={exportAll}>
                Export backup
              </Button>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold cursor-pointer hover:bg-zinc-50">
                <Upload className="w-4 h-4" />
                Import backup
                <input type="file" accept=".json" className="hidden" onChange={importAll} />
              </label>
            </div>
          </CardBody>
        </Card>

        {/* Danger */}
        <Card className="!border-red-100">
          <CardHeader className="!border-red-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-sm font-bold text-red-700">Danger zone</span>
            </div>
          </CardHeader>
          <CardBody className="space-y-2">
            <button
              onClick={() => {
                if (confirm("Clear all generations?")) history.clear();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-red-100 text-left hover:bg-red-50/40 transition-colors group"
            >
              <Trash2 className="w-4 h-4 text-red-400 group-hover:text-red-600" />
              <div>
                <p className="text-sm font-bold text-red-700">Clear generation history</p>
                <p className="text-xs text-red-400">
                  Remove all {history.entries.length} saved AI outputs
                </p>
              </div>
            </button>
            <button
              onClick={wipeAll}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-left hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
              <div>
                <p className="text-sm font-bold text-red-800">Delete ALL local data</p>
                <p className="text-xs text-red-500">
                  Wipes keys, profile, resumes, applications, contacts, history.
                </p>
              </div>
            </button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
