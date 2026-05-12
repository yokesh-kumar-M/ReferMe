"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useDashboardStore } from "@/store/dashboardStore";
import {
  Briefcase, Send, Mic, Trophy, TrendingUp, Plus,
  ArrowRight, Clock, Building, Zap, Target, ChevronRight
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  saved: "bg-zinc-100 text-zinc-600",
  applied: "bg-blue-100 text-blue-700",
  screening: "bg-amber-100 text-amber-700",
  interview: "bg-violet-100 text-violet-700",
  offer: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-600",
  withdrawn: "bg-zinc-100 text-zinc-500",
};

const STATUS_LABELS: Record<string, string> = {
  saved: "Saved",
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: React.ElementType;
  color: string; sub?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon size={20} />
      </div>
      <p className="text-2xl font-black text-zinc-900">{value}</p>
      <p className="text-sm font-semibold text-zinc-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-zinc-400 mt-1">{sub}</p>}
    </motion.div>
  );
}

export default function DashboardHome() {
  const { applications, getStats } = useDashboardStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  const stats = getStats();
  const recent = [...applications]
    .sort((a, b) => b.lastUpdated - a.lastUpdated)
    .slice(0, 5);

  const funnelStages = [
    { status: 'saved', count: applications.filter(a => a.status === 'saved').length },
    { status: 'applied', count: applications.filter(a => a.status === 'applied').length },
    { status: 'screening', count: applications.filter(a => a.status === 'screening').length },
    { status: 'interview', count: applications.filter(a => a.status === 'interview').length },
    { status: 'offer', count: applications.filter(a => a.status === 'offer').length },
  ];

  const maxCount = Math.max(...funnelStages.map(s => s.count), 1);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">{today}</p>
        <h1 className="text-2xl font-black text-zinc-900 mt-1">Your Job Search Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">Track applications, optimize your resume, and land your next role.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Jobs"
          value={stats.total}
          icon={Briefcase}
          color="bg-indigo-50 text-indigo-600"
          sub="in pipeline"
        />
        <StatCard
          label="Applied"
          value={stats.applied}
          icon={Send}
          color="bg-blue-50 text-blue-600"
          sub="submitted"
        />
        <StatCard
          label="Interviews"
          value={stats.interviewing}
          icon={Mic}
          color="bg-violet-50 text-violet-600"
          sub="scheduled or done"
        />
        <StatCard
          label="Offers"
          value={stats.offers}
          icon={Trophy}
          color="bg-emerald-50 text-emerald-600"
          sub={stats.applied > 0 ? `${stats.offerRate}% offer rate` : "keep applying!"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funnel */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-zinc-800">Application Funnel</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Pipeline overview</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <TrendingUp size={14} className="text-emerald-500" />
              {stats.responseRate}% response rate
            </div>
          </div>
          <div className="space-y-3">
            {funnelStages.map(({ status, count }) => (
              <div key={status} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-zinc-500 w-20 capitalize">{STATUS_LABELS[status]}</span>
                <div className="flex-1 bg-zinc-100 rounded-full h-7 relative overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / maxCount) * 100}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={`h-full rounded-full flex items-center px-3 ${
                      status === 'saved' ? 'bg-zinc-300' :
                      status === 'applied' ? 'bg-blue-400' :
                      status === 'screening' ? 'bg-amber-400' :
                      status === 'interview' ? 'bg-violet-500' :
                      'bg-emerald-500'
                    }`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-600">
                    {count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-800 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { href: "/dashboard/tracker", icon: Plus, label: "Add a Job", color: "text-indigo-600 bg-indigo-50" },
                { href: "/dashboard/resume", icon: Target, label: "Optimize Resume", color: "text-violet-600 bg-violet-50" },
                { href: "/dashboard/ai", icon: Zap, label: "Generate Cover Letter", color: "text-amber-600 bg-amber-50" },
              ].map(({ href, icon: Icon, label, color }) => (
                <Link key={href} href={href}>
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50 transition-all group cursor-pointer">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                      <Icon size={16} />
                    </div>
                    <span className="text-sm font-semibold text-zinc-700 flex-1">{label}</span>
                    <ChevronRight size={14} className="text-zinc-300 group-hover:text-zinc-500 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Applications */}
      {recent.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
            <h2 className="text-sm font-bold text-zinc-800">Recent Applications</h2>
            <Link href="/dashboard/tracker">
              <span className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                View all <ArrowRight size={12} />
              </span>
            </Link>
          </div>
          <div className="divide-y divide-zinc-50">
            {recent.map((app) => (
              <div key={app.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-zinc-50 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center shrink-0">
                  <Building size={16} className="text-zinc-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-800 truncate">{app.jobTitle}</p>
                  <p className="text-xs text-zinc-500 truncate">{app.company} · {app.location}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {app.atsScore !== undefined && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      app.atsScore >= 75 ? 'bg-emerald-100 text-emerald-700' :
                      app.atsScore >= 50 ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-600'
                    }`}>
                      {app.atsScore}%
                    </span>
                  )}
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_COLORS[app.status]}`}>
                    {STATUS_LABELS[app.status]}
                  </span>
                  <span className="text-xs text-zinc-400 flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(app.lastUpdated).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {applications.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-8 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-10 text-center border border-indigo-100"
        >
          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Briefcase size={28} className="text-indigo-500" />
          </div>
          <h3 className="text-base font-bold text-zinc-800 mb-2">Start Tracking Your Job Search</h3>
          <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-5">
            Add your first job application to get insights, track progress, and land your next role.
          </p>
          <Link href="/dashboard/tracker">
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-md shadow-indigo-500/20">
              Add First Job
            </button>
          </Link>
        </motion.div>
      )}
    </div>
  );
}
