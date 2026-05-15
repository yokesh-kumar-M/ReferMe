"use client";

// Insider Connections / Network. Three things in one surface:
//   1. Contact directory — recruiters, hiring managers, employees you've
//      saved, optionally linked to applications.
//   2. Email guesser — paste a LinkedIn URL + company, get likely emails.
//   3. Outreach drafter — generate referral / cold mail / LinkedIn note
//      grounded in the selected contact + a target job.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Users, Plus, Search, X, Trash2, Mail, Sparkles,
  Wand2, Send, Loader2, Copy,
} from "lucide-react";

import { useTrackerStore } from "@/store/trackerStore";
import { useKeysStore, hasAnyKey } from "@/store/keysStore";
import { useProfileStore } from "@/store/profileStore";
import { useHistoryStore } from "@/store/historyStore";

import {
  generateEmailGuesses,
  extractCompanyDomain,
  type EmailGuess,
} from "@/lib/emailGuesser";
import { streamText } from "@/features/ai/client";
import { systemPrompt, userPrompt, GENERATION_LABELS } from "@/features/ai/prompts";

import {
  Button, Input, Textarea, Card, CardHeader, CardBody, Badge,
} from "@/components/ui";
import type { Contact, ContactType, GenerationType } from "@/types";

const TYPE_OPTIONS: { value: ContactType; label: string }[] = [
  { value: "recruiter", label: "Recruiter" },
  { value: "hiring-manager", label: "Hiring Manager" },
  { value: "employee", label: "Employee" },
  { value: "referrer", label: "Referrer" },
  { value: "other", label: "Other" },
];

const OUTREACH_TYPES: GenerationType[] = ["referral", "cold_mail", "linkedin"];

export default function NetworkPage() {
  const tracker = useTrackerStore();
  const keys = useKeysStore();
  const profile = useProfileStore();
  const history = useHistoryStore();

  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Email guesser
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [manualDomain, setManualDomain] = useState("");
  const [guessJobTitle, setGuessJobTitle] = useState("");
  const [guessJobDescription, setGuessJobDescription] = useState("");
  const [guesses, setGuesses] = useState<EmailGuess[]>([]);

  // Outreach drafter
  const [outType, setOutType] = useState<GenerationType>("referral");
  const [targetJobId, setTargetJobId] = useState<string>("");
  const [draftRecruiterEmail, setDraftRecruiterEmail] = useState("");
  const [draftSharedConn, setDraftSharedConn] = useState("");
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const cancelRef = useRef(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const filtered = tracker.contacts.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [c.name, c.email, c.company, c.role, c.notes]
      .filter(Boolean)
      .some((t) => t.toLowerCase().includes(q));
  });

  const selected = selectedId ? tracker.contacts.find((c) => c.id === selectedId) ?? null : null;
  const targetJob = targetJobId
    ? tracker.applications.find((a) => a.id === targetJobId) ?? null
    : null;

  function runGuesses() {
    const domain = manualDomain || extractCompanyDomain(guessJobTitle, guessJobDescription);
    const list = generateEmailGuesses(linkedinUrl, guessJobTitle, guessJobDescription, domain);
    setGuesses(list);
    if (list[0]) setDraftRecruiterEmail(list[0].email);
  }

  async function generateOutreach() {
    if (!hasAnyKey(keys)) {
      setError("Add an API key in Settings first");
      return;
    }
    const resume = profile.getActiveResumeText();
    if (!resume) {
      setError("Add a resume first");
      return;
    }
    if (!targetJob && !guessJobDescription) {
      setError("Pick a target job from the tracker, or paste a JD in the guesser");
      return;
    }

    const jobTitle = targetJob?.jobTitle || guessJobTitle;
    const company = targetJob?.company || "";
    const jobDescription = targetJob?.jobDescription || guessJobDescription;
    const recruiterName = selected?.name || "";
    const recruiterEmail = selected?.email || draftRecruiterEmail;

    cancelRef.current = false;
    setStreaming(true);
    setError("");
    setDraft("");
    try {
      const ctx = {
        jobTitle,
        jobDescription,
        resume,
        companyName: company,
        recruiterName,
        recruiterEmail,
        sharedConnection: draftSharedConn.trim() || undefined,
      };
      let acc = "";
      for await (const delta of streamText(
        { keys: keys.keys, models: keys.models, primary: keys.primary },
        {
          system: systemPrompt(outType, ctx),
          user: userPrompt(outType, ctx),
        }
      )) {
        if (cancelRef.current) break;
        acc += delta;
        setDraft(acc);
      }
      if (acc) {
        history.add({ type: outType, jobTitle: jobTitle || "Untitled", company, result: acc });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setStreaming(false);
    }
  }

  function mailDraft() {
    if (!draft) return;
    const targetEmail = selected?.email || draftRecruiterEmail;
    let subject = targetJob?.jobTitle ? `Application for ${targetJob.jobTitle}` : "Quick intro";
    let body = draft;
    const m = draft.match(/^Subject:\s*(.+)$/m);
    if (m) {
      subject = m[1].trim();
      body = draft.replace(/^Subject:\s*(.+)$/m, "").trim();
    }
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      targetEmail
    )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank", "noreferrer");
  }

  function copyDraft() {
    if (!draft) return;
    navigator.clipboard.writeText(draft).catch(() => {});
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <header className="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black text-zinc-900">Insider Connections</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Find emails, draft outreach, and keep a CRM of recruiters and referrers.
          </p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setShowAdd(true)}>
          Add contact
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Contacts column */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search contacts…"
                  className="pl-9 pr-3 py-2 w-full text-sm rounded-xl border border-zinc-200 bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </CardHeader>
            <CardBody className="!p-0">
              {filtered.length === 0 ? (
                <p className="text-xs text-zinc-400 p-5 text-center">
                  No contacts yet — add one to get started.
                </p>
              ) : (
                <ul className="divide-y divide-zinc-50 max-h-[640px] overflow-y-auto custom-scrollbar">
                  {filtered.map((c) => (
                    <li
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={
                        "px-4 py-3 cursor-pointer hover:bg-zinc-50 transition-colors " +
                        (c.id === selectedId ? "bg-indigo-50/50" : "")
                      }
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4 text-zinc-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-zinc-800 truncate">
                            {c.name || "Unnamed"}
                          </p>
                          <p className="text-[11px] text-zinc-500 truncate">
                            {[c.role, c.company].filter(Boolean).join(" · ") || "—"}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge tone="indigo">{c.type.replace("-", " ")}</Badge>
                            {c.linkedJobIds.length > 0 && (
                              <Badge tone="violet">
                                {c.linkedJobIds.length} job{c.linkedJobIds.length === 1 ? "" : "s"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right side: guesser + drafter */}
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-bold text-zinc-800">Email guesser</span>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="LinkedIn URL"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/jane-doe"
                />
                <Input
                  label="Company domain (optional)"
                  value={manualDomain}
                  onChange={(e) => setManualDomain(e.target.value)}
                  placeholder="acme.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Job title (helps domain detection)"
                  value={guessJobTitle}
                  onChange={(e) => setGuessJobTitle(e.target.value)}
                />
                <Input
                  label=" "
                  value=""
                  onChange={() => {}}
                  className="opacity-0 pointer-events-none"
                />
              </div>
              <Textarea
                label="Job description (optional)"
                rows={3}
                value={guessJobDescription}
                onChange={(e) => setGuessJobDescription(e.target.value)}
                placeholder="Pasting the JD helps detect the company domain when it's not obvious from the title."
              />
              <Button variant="primary" icon={<Wand2 className="w-4 h-4" />} onClick={runGuesses}>
                Generate guesses
              </Button>
              {guesses.length > 0 && (
                <div className="bg-zinc-50 border border-zinc-100 rounded-xl divide-y divide-zinc-100">
                  {guesses.map((g) => (
                    <div key={g.email} className="flex items-center gap-2 px-3 py-2">
                      <span className="text-sm font-mono text-zinc-800 flex-1 truncate">
                        {g.email}
                      </span>
                      <Badge
                        tone={
                          g.confidence === "high"
                            ? "emerald"
                            : g.confidence === "medium"
                            ? "amber"
                            : "red"
                        }
                      >
                        {g.confidence}
                      </Badge>
                      <span className="text-[10px] text-zinc-400">{g.pattern}</span>
                      <button
                        onClick={() => {
                          setDraftRecruiterEmail(g.email);
                          navigator.clipboard.writeText(g.email).catch(() => {});
                        }}
                        className="text-zinc-400 hover:text-indigo-600 p-1"
                        title="Use this email"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-500" />
                  <span className="text-sm font-bold text-zinc-800">Draft outreach</span>
                </div>
                <div className="flex items-center gap-1">
                  {OUTREACH_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setOutType(t)}
                      className={
                        "text-[11px] font-bold px-2.5 py-1 rounded-lg border " +
                        (outType === t
                          ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                          : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50")
                      }
                    >
                      {GENERATION_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[11px] uppercase tracking-wider font-bold text-zinc-500 mb-1.5">
                    Target job
                  </span>
                  <select
                    value={targetJobId}
                    onChange={(e) => setTargetJobId(e.target.value)}
                    className="w-full text-sm px-3 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50"
                  >
                    <option value="">— Use guesser context —</option>
                    {tracker.applications.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.jobTitle}
                        {a.company ? ` @ ${a.company}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <Input
                  label="Recipient email"
                  value={selected?.email || draftRecruiterEmail}
                  onChange={(e) => setDraftRecruiterEmail(e.target.value)}
                  disabled={!!selected?.email}
                  hint={selected ? "Using selected contact" : "(optional)"}
                />
              </div>
              <Input
                label="Shared connection (optional)"
                value={draftSharedConn}
                onChange={(e) => setDraftSharedConn(e.target.value)}
                placeholder="e.g. We both attended Carnegie Mellon"
              />
              {streaming ? (
                <Button variant="outline" icon={<X className="w-4 h-4" />} onClick={() => (cancelRef.current = true)}>
                  Stop
                </Button>
              ) : (
                <Button variant="primary" icon={<Wand2 className="w-4 h-4" />} onClick={generateOutreach}>
                  Generate draft
                </Button>
              )}
              {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
              {(streaming || draft) && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3">
                  {streaming && !draft && (
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                      Drafting…
                    </div>
                  )}
                  {draft && (
                    <>
                      <pre className="text-xs whitespace-pre-wrap leading-relaxed text-zinc-800 font-sans">
                        {draft}
                      </pre>
                      <div className="flex gap-2 mt-3">
                        <Button variant="outline" size="sm" icon={<Copy className="w-3.5 h-3.5" />} onClick={copyDraft}>
                          Copy
                        </Button>
                        <Button variant="primary" size="sm" icon={<Send className="w-3.5 h-3.5" />} onClick={mailDraft}>
                          Open in Gmail
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          {selected && (
            // Keyed on selected.id so the internal draft resets cleanly
            // when the user switches contacts instead of useEffect-syncing.
            <ContactDetail
              key={selected.id}
              contact={selected}
              onClose={() => setSelectedId(null)}
              onUpdate={(updates) => tracker.updateContact(selected.id, updates)}
              onDelete={() => {
                if (confirm(`Delete ${selected.name || "contact"}?`)) {
                  tracker.deleteContact(selected.id);
                  setSelectedId(null);
                }
              }}
            />
          )}
        </div>
      </div>

      {showAdd && <AddContactModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function ContactDetail({
  contact,
  onClose,
  onUpdate,
  onDelete,
}: {
  contact: Contact;
  onClose: () => void;
  onUpdate: (updates: Partial<Contact>) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(contact);
  useEffect(() => setDraft(contact), [contact.id]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-bold text-zinc-800">Edit contact</span>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Name"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
          <label className="block">
            <span className="block text-[11px] uppercase tracking-wider font-bold text-zinc-500 mb-1.5">
              Type
            </span>
            <select
              value={draft.type}
              onChange={(e) =>
                setDraft((d) => ({ ...d, type: e.target.value as ContactType }))
              }
              className="w-full text-sm px-3 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Role"
            value={draft.role}
            onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
          />
          <Input
            label="Company"
            value={draft.company}
            onChange={(e) => setDraft((d) => ({ ...d, company: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Email"
            value={draft.email}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
          />
          <Input
            label="LinkedIn URL"
            value={draft.linkedinUrl}
            onChange={(e) => setDraft((d) => ({ ...d, linkedinUrl: e.target.value }))}
          />
        </div>
        <Textarea
          label="Notes"
          rows={3}
          value={draft.notes}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
        />
        <div className="flex justify-between">
          <Button variant="ghost" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={onDelete}>
            Delete
          </Button>
          <Button variant="primary" onClick={() => onUpdate(draft)}>
            Save changes
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function AddContactModal({ onClose }: { onClose: () => void }) {
  const tracker = useTrackerStore();
  const [form, setForm] = useState({
    name: "",
    role: "",
    company: "",
    email: "",
    linkedinUrl: "",
    phone: "",
    type: "recruiter" as ContactType,
    notes: "",
  });

  function submit() {
    if (!form.name.trim() && !form.email.trim() && !form.linkedinUrl.trim()) return;
    tracker.addContact({
      ...form,
      lastContacted: null,
      linkedJobIds: [],
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-zinc-200 w-full max-w-lg"
      >
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-base font-black text-zinc-900">Add contact</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Name*"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <label className="block">
              <span className="block text-[11px] uppercase tracking-wider font-bold text-zinc-500 mb-1.5">
                Type
              </span>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ContactType }))}
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Role"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            />
            <Input
              label="Company"
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            />
          </div>
          <Input
            label="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Input
            label="LinkedIn URL"
            value={form.linkedinUrl}
            onChange={(e) => setForm((f) => ({ ...f, linkedinUrl: e.target.value }))}
          />
          <Textarea
            label="Notes"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
        <div className="px-6 py-4 border-t border-zinc-100 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Add contact
          </Button>
        </div>
      </div>
    </div>
  );
}
