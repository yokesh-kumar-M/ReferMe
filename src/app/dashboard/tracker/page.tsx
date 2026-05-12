"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardStore, AppStatus, JobApplication } from "@/store/dashboardStore";
import {
  Plus, X, Building, MapPin, Link2, DollarSign, FileText,
  ChevronDown, Clock, Target, Star, Trash2, Edit3, ExternalLink,
  CheckCircle2, AlertCircle, Calendar, MessageSquare, Briefcase, ArrowRight
} from "lucide-react";

const COLUMNS: { status: AppStatus; label: string; color: string; bg: string; dot: string }[] = [
  { status: "saved", label: "Saved", color: "text-zinc-600", bg: "bg-zinc-100", dot: "bg-zinc-400" },
  { status: "applied", label: "Applied", color: "text-blue-700", bg: "bg-blue-50", dot: "bg-blue-500" },
  { status: "screening", label: "Screening", color: "text-amber-700", bg: "bg-amber-50", dot: "bg-amber-500" },
  { status: "interview", label: "Interview", color: "text-violet-700", bg: "bg-violet-50", dot: "bg-violet-500" },
  { status: "offer", label: "Offer 🎉", color: "text-emerald-700", bg: "bg-emerald-50", dot: "bg-emerald-500" },
  { status: "rejected", label: "Rejected", color: "text-red-600", bg: "bg-red-50", dot: "bg-red-400" },
];

const PRIORITY_COLORS = {
  high: "text-red-500 bg-red-50",
  medium: "text-amber-500 bg-amber-50",
  low: "text-zinc-400 bg-zinc-50",
};

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : score >= 50 ? "bg-amber-100 text-amber-700 border-amber-200"
    : "bg-red-100 text-red-600 border-red-200";
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${color}`}>
      ATS {score}%
    </span>
  );
}

function AddJobModal({ onClose, onAdd, defaultStatus }: {
  onClose: () => void;
  onAdd: (status: AppStatus) => void;
  defaultStatus: AppStatus;
}) {
  const { addApplication } = useDashboardStore();
  const [form, setForm] = useState({
    jobTitle: "",
    company: "",
    location: "",
    jobUrl: "",
    jobDescription: "",
    salary: "",
    jobType: "full-time" as const,
    remote: false,
    notes: "",
    priority: "medium" as const,
    status: defaultStatus,
    source: "manual",
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState("");

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.jobTitle || !form.company) return;
    addApplication({
      ...form,
      companyDomain: form.jobUrl ? new URL(form.jobUrl.startsWith("http") ? form.jobUrl : `https://${form.jobUrl}`).hostname.replace("www.", "") : undefined,
    });
    onAdd(form.status);
    onClose();
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      set("tags", [...form.tags, tag]);
    }
    setTagInput("");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-base font-black text-zinc-900">Add Job Application</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Job Title *</label>
              <input value={form.jobTitle} onChange={e => set("jobTitle", e.target.value)} required
                placeholder="Senior Software Engineer"
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Company *</label>
              <input value={form.company} onChange={e => set("company", e.target.value)} required
                placeholder="Acme Corp"
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Location</label>
              <input value={form.location} onChange={e => set("location", e.target.value)}
                placeholder="San Francisco, CA (Remote)"
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Job URL</label>
              <input value={form.jobUrl} onChange={e => set("jobUrl", e.target.value)}
                placeholder="https://linkedin.com/jobs/..."
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Salary Range</label>
              <input value={form.salary} onChange={e => set("salary", e.target.value)}
                placeholder="$120k - $160k"
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 outline-none transition-all">
                {COLUMNS.map(c => <option key={c.status} value={c.status}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Priority</label>
              <select value={form.priority} onChange={e => set("priority", e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 outline-none transition-all">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Job Description</label>
              <textarea value={form.jobDescription} onChange={e => set("jobDescription", e.target.value)}
                rows={4} placeholder="Paste the full job description for ATS analysis..."
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Notes</label>
              <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
                rows={2} placeholder="Any notes about this application..."
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Tags</label>
              <div className="flex gap-2">
                <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); }}}
                  placeholder="e.g. remote, startup, urgent"
                  className="flex-1 px-3 py-2 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 outline-none transition-all" />
                <button type="button" onClick={addTag} className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-sm font-bold rounded-xl transition-colors">
                  Add
                </button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-medium">
                      {tag}
                      <button type="button" onClick={() => set("tags", form.tags.filter(t => t !== tag))} className="hover:text-red-500">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-600 hover:bg-zinc-50 transition-colors">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors shadow-sm shadow-indigo-500/20">
              Add Application
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function JobCard({ app, onMove, onDelete, onEdit }: {
  app: JobApplication;
  onMove: (status: AppStatus) => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const nextStatuses = COLUMNS
    .filter(c => c.status !== app.status)
    .slice(0, 3);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white rounded-xl border border-zinc-200/80 p-3.5 shadow-sm hover:shadow-md hover:border-zinc-300 transition-all group cursor-default"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-zinc-800 truncate leading-tight">{app.jobTitle}</p>
          <p className="text-xs text-zinc-500 font-medium mt-0.5 truncate">{app.company}</p>
        </div>
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-lg text-zinc-300 hover:text-zinc-600 hover:bg-zinc-100 transition-colors opacity-0 group-hover:opacity-100"
          >
            <ChevronDown size={14} />
          </button>
          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.95 }}
                className="absolute right-0 top-full mt-1 w-44 bg-white border border-zinc-200 rounded-xl shadow-xl z-20 overflow-hidden"
              >
                <div className="py-1">
                  <p className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Move to</p>
                  {nextStatuses.map(col => (
                    <button key={col.status} onClick={() => { onMove(col.status); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors">
                      <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                      {col.label}
                    </button>
                  ))}
                  <div className="border-t border-zinc-100 mt-1 pt-1">
                    <button onClick={() => { onEdit(); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors">
                      <Edit3 size={12} /> Edit
                    </button>
                    {app.jobUrl && (
                      <a href={app.jobUrl} target="_blank" rel="noreferrer"
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors">
                        <ExternalLink size={12} /> Open Job
                      </a>
                    )}
                    <button onClick={() => { onDelete(); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors">
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {app.location && (
        <div className="flex items-center gap-1 mb-2">
          <MapPin size={10} className="text-zinc-400 shrink-0" />
          <span className="text-[11px] text-zinc-400 truncate">{app.location}</span>
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        {app.atsScore !== undefined && <ScoreBadge score={app.atsScore} />}
        {app.salary && (
          <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-50 border border-zinc-100 px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <DollarSign size={9} />{app.salary}
          </span>
        )}
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${PRIORITY_COLORS[app.priority]}`}>
          {app.priority}
        </span>
        {app.remote && (
          <span className="text-[10px] font-semibold text-teal-600 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded-full">
            Remote
          </span>
        )}
      </div>

      {app.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-2">
          {app.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-[10px] font-medium text-zinc-400 bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-100">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 mt-2.5 pt-2.5 border-t border-zinc-50">
        <Clock size={10} className="text-zinc-300" />
        <span className="text-[10px] text-zinc-400">
          {app.appliedDate ? `Applied ${new Date(app.appliedDate).toLocaleDateString()}` : `Saved ${new Date(app.savedDate).toLocaleDateString()}`}
        </span>
        {app.interviews.length > 0 && (
          <span className="ml-auto text-[10px] text-violet-500 font-semibold flex items-center gap-0.5">
            <Calendar size={10} /> {app.interviews.length} interview{app.interviews.length > 1 ? 's' : ''}
          </span>
        )}
        {app.notes && (
          <span className="ml-auto text-zinc-300">
            <MessageSquare size={10} />
          </span>
        )}
      </div>
    </motion.div>
  );
}

function EditJobModal({ app, onClose }: { app: JobApplication; onClose: () => void }) {
  const { updateApplication, deleteApplication } = useDashboardStore();
  const [form, setForm] = useState(app);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    updateApplication(app.id, form);
    onClose();
  };

  const handleDelete = () => {
    if (confirm("Delete this application?")) {
      deleteApplication(app.id);
      onClose();
    }
  };

  const addInterview = () => {
    const interview = {
      id: Date.now().toString(36),
      date: Date.now(),
      type: 'video' as const,
      notes: "",
      outcome: 'pending' as const,
    };
    set("interviews", [...form.interviews, interview]);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div>
            <h2 className="text-base font-black text-zinc-900">{form.jobTitle}</h2>
            <p className="text-xs text-zinc-500">{form.company}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Job Title</label>
              <input value={form.jobTitle} onChange={e => set("jobTitle", e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Company</label>
              <input value={form.company} onChange={e => set("company", e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 outline-none">
                {COLUMNS.map(c => <option key={c.status} value={c.status}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Salary</label>
              <input value={form.salary || ""} onChange={e => set("salary", e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Notes</label>
              <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 outline-none resize-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Cover Letter</label>
              <textarea value={form.coverLetter || ""} onChange={e => set("coverLetter", e.target.value)} rows={4}
                placeholder="Paste generated cover letter here..."
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 outline-none resize-none" />
            </div>
          </div>

          {/* Interviews */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Interviews</label>
              <button onClick={addInterview} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                <Plus size={12} /> Add
              </button>
            </div>
            <div className="space-y-2">
              {form.interviews.map((iv, i) => (
                <div key={iv.id} className="flex items-center gap-2 bg-zinc-50 rounded-xl p-2.5 border border-zinc-200">
                  <select value={iv.type}
                    onChange={e => set("interviews", form.interviews.map((x, j) => j === i ? { ...x, type: e.target.value } : x))}
                    className="text-xs rounded-lg border border-zinc-200 px-2 py-1 bg-white outline-none">
                    <option value="phone">Phone</option>
                    <option value="video">Video</option>
                    <option value="technical">Technical</option>
                    <option value="onsite">Onsite</option>
                    <option value="hr">HR</option>
                  </select>
                  <input type="date"
                    value={new Date(iv.date).toISOString().split('T')[0]}
                    onChange={e => set("interviews", form.interviews.map((x, j) => j === i ? { ...x, date: new Date(e.target.value).getTime() } : x))}
                    className="text-xs rounded-lg border border-zinc-200 px-2 py-1 bg-white outline-none" />
                  <select value={iv.outcome || 'pending'}
                    onChange={e => set("interviews", form.interviews.map((x, j) => j === i ? { ...x, outcome: e.target.value } : x))}
                    className="text-xs rounded-lg border border-zinc-200 px-2 py-1 bg-white outline-none">
                    <option value="pending">Pending</option>
                    <option value="passed">Passed</option>
                    <option value="failed">Failed</option>
                  </select>
                  <button onClick={() => set("interviews", form.interviews.filter((_, j) => j !== i))}
                    className="ml-auto text-zinc-400 hover:text-red-500">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={handleDelete}
              className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-bold hover:bg-red-50 transition-colors flex items-center gap-1.5">
              <Trash2 size={14} /> Delete
            </button>
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-600 hover:bg-zinc-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors">
              Save Changes
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function TrackerPage() {
  const { applications, moveApplication, deleteApplication, getApplicationsByStatus } = useDashboardStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [addStatus, setAddStatus] = useState<AppStatus>("saved");
  const [editApp, setEditApp] = useState<JobApplication | null>(null);
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const filteredApps = filter
    ? applications.filter(a =>
        a.jobTitle.toLowerCase().includes(filter.toLowerCase()) ||
        a.company.toLowerCase().includes(filter.toLowerCase())
      )
    : applications;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 border-b border-zinc-200/80 bg-white flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-black text-zinc-900">Job Tracker</h1>
          <p className="text-xs text-zinc-400 mt-0.5">{applications.length} applications tracked</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Search jobs..."
            className="px-3 py-2 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 outline-none w-48 transition-all"
          />
          <button
            onClick={() => { setAddStatus("saved"); setShowAddModal(true); }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm shadow-indigo-500/20"
          >
            <Plus size={16} /> Add Job
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 p-5 h-full" style={{ minWidth: `${COLUMNS.length * 280}px` }}>
          {COLUMNS.map((col) => {
            const colApps = filteredApps.filter(a => a.status === col.status);
            return (
              <div key={col.status} className="flex flex-col w-68 min-w-[260px] flex-shrink-0">
                {/* Column Header */}
                <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl mb-3 ${col.bg}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className={`text-xs font-black ${col.color}`}>{col.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white/60 ${col.color}`}>
                      {colApps.length}
                    </span>
                    <button
                      onClick={() => { setAddStatus(col.status); setShowAddModal(true); }}
                      className={`p-1 rounded-lg hover:bg-white/50 transition-colors ${col.color} opacity-60 hover:opacity-100`}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 custom-scrollbar">
                  <AnimatePresence mode="popLayout">
                    {colApps.map((app) => (
                      <JobCard
                        key={app.id}
                        app={app}
                        onMove={(status) => moveApplication(app.id, status)}
                        onDelete={() => deleteApplication(app.id)}
                        onEdit={() => setEditApp(app)}
                      />
                    ))}
                  </AnimatePresence>
                  {colApps.length === 0 && (
                    <div
                      onClick={() => { setAddStatus(col.status); setShowAddModal(true); }}
                      className="border-2 border-dashed border-zinc-200 rounded-xl p-6 text-center cursor-pointer hover:border-zinc-300 hover:bg-zinc-50 transition-all"
                    >
                      <Plus size={20} className="text-zinc-300 mx-auto mb-1" />
                      <p className="text-xs text-zinc-400 font-medium">Add a job</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showAddModal && (
          <AddJobModal
            onClose={() => setShowAddModal(false)}
            onAdd={() => {}}
            defaultStatus={addStatus}
          />
        )}
        {editApp && (
          <EditJobModal
            app={editApp}
            onClose={() => setEditApp(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
