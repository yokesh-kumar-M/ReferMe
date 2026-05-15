"use client";

// Kanban-style job tracker. Six columns: Saved → Applied → Screening →
// Interview → Offer / Rejected. Cards are drag-and-drop using the HTML5
// drag API (no extra deps). Click a card to open the detail drawer.

import React, { useState } from "react";
import { useMounted } from "@/lib/useMounted";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, X, Building, MapPin, Link2, DollarSign, FileText, Trash2,
  Star, Calendar, ExternalLink, ChevronRight, Search, ArrowRight,
} from "lucide-react";

import { useTrackerStore } from "@/store/trackerStore";
import type { ApplicationStatus, JobApplication, Priority } from "@/types";
import { Button, Input, Textarea, Badge, Card, CardBody } from "@/components/ui";
import { scoreATS } from "@/features/ats/score";
import { useProfileStore } from "@/store/profileStore";

interface ColumnSpec {
  status: ApplicationStatus;
  label: string;
  accent: string;
  dot: string;
}

const COLUMNS: ColumnSpec[] = [
  { status: "saved", label: "Saved", accent: "text-zinc-600", dot: "bg-zinc-400" },
  { status: "applied", label: "Applied", accent: "text-blue-700", dot: "bg-blue-500" },
  { status: "screening", label: "Screening", accent: "text-amber-700", dot: "bg-amber-500" },
  { status: "interview", label: "Interview", accent: "text-violet-700", dot: "bg-violet-500" },
  { status: "offer", label: "Offer", accent: "text-emerald-700", dot: "bg-emerald-500" },
  { status: "rejected", label: "Rejected", accent: "text-red-600", dot: "bg-red-400" },
];

const PRIORITY_COLOR: Record<Priority, string> = {
  high: "text-red-500",
  medium: "text-amber-500",
  low: "text-zinc-400",
};

export default function TrackerPage() {
  const tracker = useTrackerStore();
  const mounted = useMounted();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addStatus, setAddStatus] = useState<ApplicationStatus>("saved");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ApplicationStatus | null>(null);

  if (!mounted) return null;

  const filtered = tracker.applications.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [a.jobTitle, a.company, a.location, a.notes, a.tags.join(" ")]
      .filter(Boolean)
      .some((t) => t.toLowerCase().includes(q));
  });

  const byStatus: Record<ApplicationStatus, JobApplication[]> = {
    saved: [], applied: [], screening: [], interview: [], offer: [], rejected: [], withdrawn: [],
  };
  filtered.forEach((a) => byStatus[a.status].push(a));

  const active = activeCardId
    ? tracker.applications.find((a) => a.id === activeCardId) ?? null
    : null;

  function onDrop(status: ApplicationStatus) {
    if (dragId) {
      tracker.moveApplication(dragId, status);
      setDragId(null);
      setDragOverCol(null);
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      <header className="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black text-zinc-900">Job Tracker</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Drag cards across columns as your applications progress.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs…"
              className="pl-9 pr-3 py-2 text-sm rounded-xl border border-zinc-200 bg-white focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
            />
          </div>
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setAddStatus("saved");
              setShowAdd(true);
            }}
          >
            Add job
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {COLUMNS.map((col) => (
          <div
            key={col.status}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverCol(col.status);
            }}
            onDragLeave={() => setDragOverCol((s) => (s === col.status ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              onDrop(col.status);
            }}
            className={
              "bg-white rounded-2xl border transition-all min-h-[420px] flex flex-col " +
              (dragOverCol === col.status
                ? "border-indigo-300 ring-2 ring-indigo-200"
                : "border-zinc-200/80")
            }
          >
            <div className="px-3.5 py-3 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                <span className={`text-xs font-bold ${col.accent}`}>{col.label}</span>
                <span className="text-[10px] font-bold text-zinc-400">
                  {byStatus[col.status].length}
                </span>
              </div>
              <button
                onClick={() => {
                  setAddStatus(col.status);
                  setShowAdd(true);
                }}
                className="text-zinc-400 hover:text-zinc-700"
                title="Add to this column"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar">
              {byStatus[col.status].map((app) => (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  draggable
                  onDragStart={() => setDragId(app.id)}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => setActiveCardId(app.id)}
                  className="bg-white border border-zinc-200/80 rounded-xl p-3 cursor-pointer hover:border-indigo-200 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center shrink-0">
                      <Building className="w-3.5 h-3.5 text-zinc-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-zinc-800 truncate">{app.jobTitle}</p>
                      <p className="text-[11px] text-zinc-500 truncate">
                        {app.company || "—"}
                      </p>
                    </div>
                    <Star className={`w-3.5 h-3.5 ${PRIORITY_COLOR[app.priority]}`} />
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {app.atsScore !== null && (
                      <Badge
                        tone={app.atsScore >= 75 ? "emerald" : app.atsScore >= 50 ? "amber" : "red"}
                      >
                        ATS {app.atsScore}
                      </Badge>
                    )}
                    {app.location && (
                      <span className="text-[10px] text-zinc-500 inline-flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" /> {app.location}
                      </span>
                    )}
                    {app.remote && <Badge tone="indigo">Remote</Badge>}
                  </div>
                </motion.div>
              ))}
              {byStatus[col.status].length === 0 && (
                <p className="text-[11px] text-zinc-400 text-center py-6">No jobs here yet</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showAdd && (
          <AddJobModal
            defaultStatus={addStatus}
            onClose={() => setShowAdd(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {active && (
          // Keyed on app.id so internal draft state resets cleanly when
          // the user switches cards instead of using useEffect to sync.
          <JobDrawer
            key={active.id}
            app={active}
            onClose={() => setActiveCardId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Add modal
// ──────────────────────────────────────────────────────────────────────

function AddJobModal({
  defaultStatus,
  onClose,
}: {
  defaultStatus: ApplicationStatus;
  onClose: () => void;
}) {
  const tracker = useTrackerStore();
  const profile = useProfileStore();
  const [form, setForm] = useState({
    jobTitle: "",
    company: "",
    location: "",
    jobUrl: "",
    jobDescription: "",
    salary: "",
    notes: "",
    priority: "medium" as Priority,
    remote: false,
  });

  function submit() {
    if (!form.jobTitle.trim()) return;
    const ats = scoreATS(profile.getActiveResumeText(), form.jobDescription);
    tracker.addApplication({
      ...form,
      status: defaultStatus,
      atsScore: form.jobDescription ? ats.score : null,
      matchedKeywords: ats.matchedKeywords.slice(0, 30),
      missingKeywords: ats.missingKeywords.slice(0, 30),
      source: "dashboard",
    });
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-zinc-200 w-full max-w-2xl"
      >
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-base font-black text-zinc-900">Add a job</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Job title*"
              value={form.jobTitle}
              onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
            />
            <Input
              label="Company"
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Location"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            />
            <Input
              label="Salary range"
              value={form.salary}
              onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))}
            />
          </div>
          <Input
            label="Job URL"
            value={form.jobUrl}
            onChange={(e) => setForm((f) => ({ ...f, jobUrl: e.target.value }))}
          />
          <Textarea
            label="Job description"
            rows={6}
            value={form.jobDescription}
            onChange={(e) => setForm((f) => ({ ...f, jobDescription: e.target.value }))}
          />
          <Textarea
            label="Notes"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <div className="flex items-center gap-3">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              Priority
            </label>
            <select
              value={form.priority}
              onChange={(e) =>
                setForm((f) => ({ ...f, priority: e.target.value as Priority }))
              }
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <label className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600">
              <input
                type="checkbox"
                checked={form.remote}
                onChange={(e) => setForm((f) => ({ ...f, remote: e.target.checked }))}
              />
              Remote
            </label>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-zinc-100 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!form.jobTitle.trim()}>
            Add to {defaultStatus}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Detail drawer
// ──────────────────────────────────────────────────────────────────────

function JobDrawer({
  app,
  onClose,
}: {
  app: JobApplication;
  onClose: () => void;
}) {
  const tracker = useTrackerStore();
  const profile = useProfileStore();
  const [draft, setDraft] = useState(app);

  function save() {
    tracker.updateApplication(app.id, draft);
    onClose();
  }

  function destroy() {
    if (!confirm(`Delete "${app.jobTitle}"?`)) return;
    tracker.deleteApplication(app.id);
    onClose();
  }

  function rescoreAts() {
    const ats = scoreATS(profile.getActiveResumeText(), draft.jobDescription);
    setDraft((d) => ({
      ...d,
      atsScore: ats.score,
      matchedKeywords: ats.matchedKeywords.slice(0, 30),
      missingKeywords: ats.missingKeywords.slice(0, 30),
    }));
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm flex items-stretch justify-end"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 60, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white shadow-2xl flex flex-col"
      >
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center">
            <Building className="w-5 h-5 text-zinc-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-zinc-900 truncate">{app.jobTitle}</p>
            <p className="text-xs text-zinc-500 truncate">{app.company || "—"}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Title"
              value={draft.jobTitle}
              onChange={(e) => setDraft((d) => ({ ...d, jobTitle: e.target.value }))}
            />
            <Input
              label="Company"
              value={draft.company}
              onChange={(e) => setDraft((d) => ({ ...d, company: e.target.value }))}
            />
            <Input
              label="Location"
              value={draft.location}
              onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
            />
            <Input
              label="Salary"
              value={draft.salary}
              onChange={(e) => setDraft((d) => ({ ...d, salary: e.target.value }))}
            />
          </div>

          <Input
            label="Job URL"
            value={draft.jobUrl}
            onChange={(e) => setDraft((d) => ({ ...d, jobUrl: e.target.value }))}
          />

          <Textarea
            label="Job description"
            rows={6}
            value={draft.jobDescription}
            onChange={(e) => setDraft((d) => ({ ...d, jobDescription: e.target.value }))}
          />

          <div className="flex items-center justify-between gap-3 bg-zinc-50 rounded-xl border border-zinc-100 p-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">ATS</p>
              <p className="text-sm font-black text-zinc-900">
                {draft.atsScore === null ? "—" : `${draft.atsScore}%`}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={rescoreAts}>
              Rescore
            </Button>
          </div>

          <Textarea
            label="Notes"
            rows={4}
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[11px] uppercase tracking-wider font-bold text-zinc-500 mb-1.5">
                Status
              </span>
              <select
                value={draft.status}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, status: e.target.value as ApplicationStatus }))
                }
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50"
              >
                {COLUMNS.map((c) => (
                  <option key={c.status} value={c.status}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[11px] uppercase tracking-wider font-bold text-zinc-500 mb-1.5">
                Priority
              </span>
              <select
                value={draft.priority}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, priority: e.target.value as Priority }))
                }
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>

          <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
              Interviews
            </p>
            {draft.interviews.length === 0 ? (
              <p className="text-xs text-zinc-400">No interviews logged yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {draft.interviews.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center gap-2 text-xs bg-white rounded-lg px-2.5 py-2 border border-zinc-100"
                  >
                    <Calendar className="w-3.5 h-3.5 text-violet-500" />
                    <span className="font-bold capitalize">{i.type}</span>
                    <span className="text-zinc-500">
                      {new Date(i.date).toLocaleDateString()}
                    </span>
                    <span className="ml-auto">
                      <Badge
                        tone={
                          i.outcome === "passed"
                            ? "emerald"
                            : i.outcome === "failed"
                            ? "red"
                            : "amber"
                        }
                      >
                        {i.outcome}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              className="mt-2"
              onClick={() => {
                tracker.addInterview(app.id, {
                  date: Date.now(),
                  type: "phone",
                  notes: "",
                  outcome: "pending",
                });
              }}
            >
              Add interview
            </Button>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <Button variant="ghost" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={destroy}>
            Delete
          </Button>
          <div className="flex gap-2">
            {draft.jobUrl && (
              <a
                href={draft.jobUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 px-3 py-2"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open
              </a>
            )}
            <Button variant="primary" onClick={save}>
              Save changes
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
