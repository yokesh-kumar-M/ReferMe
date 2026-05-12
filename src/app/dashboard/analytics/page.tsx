"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useDashboardStore, AppStatus } from "@/store/dashboardStore";
import { BarChart3, TrendingUp, Target, Clock, Award, Calendar } from "lucide-react";

const STATUS_LABELS: Record<AppStatus, string> = {
  saved: "Saved", applied: "Applied", screening: "Screening",
  interview: "Interview", offer: "Offer", rejected: "Rejected", withdrawn: "Withdrawn",
};

const STATUS_COLORS: Record<AppStatus, string> = {
  saved: "#a1a1aa", applied: "#3b82f6", screening: "#f59e0b",
  interview: "#8b5cf6", offer: "#10b981", rejected: "#ef4444", withdrawn: "#d4d4d8",
};

function Bar({ label, value, max, color, count }: { label: string; value: number; max: number; color: string; count: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold text-zinc-500 w-20 text-right shrink-0">{label}</span>
      <div className="flex-1 bg-zinc-100 rounded-full h-8 relative overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-600">{count}</span>
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-sm">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-black text-zinc-900">{value}</p>
      <p className="text-xs text-zinc-500 font-semibold mt-0.5">{label}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { applications } = useDashboardStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const statuses: AppStatus[] = ["saved", "applied", "screening", "interview", "offer", "rejected", "withdrawn"];
  const counts = statuses.map(s => applications.filter(a => a.status === s).length);
  const maxCount = Math.max(...counts, 1);

  const applied = applications.filter(a => a.status !== "saved").length;
  const responded = applications.filter(a => ["screening", "interview", "offer"].includes(a.status)).length;
  const offers = applications.filter(a => a.status === "offer").length;
  const responseRate = applied > 0 ? Math.round((responded / applied) * 100) : 0;
  const offerRate = applied > 0 ? Math.round((offers / applied) * 100) : 0;
  const avgAts = applications.filter(a => a.atsScore !== undefined).length > 0
    ? Math.round(applications.filter(a => a.atsScore !== undefined).reduce((s, a) => s + (a.atsScore || 0), 0) / applications.filter(a => a.atsScore !== undefined).length)
    : 0;

  // Applications per week (last 8 weeks)
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = now - (i + 1) * week;
    const end = now - i * week;
    const count = applications.filter(a => a.appliedDate && a.appliedDate >= start && a.appliedDate < end).length;
    return { label: `W-${i + 1}`, count };
  }).reverse();
  const maxWeek = Math.max(...weeks.map(w => w.count), 1);

  // Company distribution
  const companies = applications.reduce<Record<string, number>>((acc, a) => {
    acc[a.company] = (acc[a.company] || 0) + 1;
    return acc;
  }, {});
  const topCompanies = Object.entries(companies).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Priority distribution
  const priorities = ["high", "medium", "low"].map(p => ({
    label: p,
    count: applications.filter(a => a.priority === p).length,
  }));

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-black text-zinc-900">Analytics</h1>
        <p className="text-xs text-zinc-400 mt-0.5">Your job search performance at a glance.</p>
      </div>

      {applications.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BarChart3 size={24} className="text-zinc-400" />
          </div>
          <p className="text-sm font-bold text-zinc-600 mb-1">No data yet</p>
          <p className="text-xs text-zinc-400">Start tracking applications to see analytics.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MiniStat label="Total Applications" value={applications.length} icon={BarChart3} color="bg-indigo-50 text-indigo-600" />
            <MiniStat label="Response Rate" value={`${responseRate}%`} icon={TrendingUp} color="bg-emerald-50 text-emerald-600" />
            <MiniStat label="Offer Rate" value={`${offerRate}%`} icon={Award} color="bg-amber-50 text-amber-600" />
            <MiniStat label="Avg ATS Score" value={avgAts > 0 ? `${avgAts}%` : "N/A"} icon={Target} color="bg-violet-50 text-violet-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status breakdown */}
            <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm">
              <h2 className="text-sm font-bold text-zinc-800 mb-4">Pipeline Breakdown</h2>
              <div className="space-y-3">
                {statuses.map((s, i) => (
                  <Bar key={s} label={STATUS_LABELS[s]} value={counts[i]} max={maxCount} color={STATUS_COLORS[s]} count={counts[i]} />
                ))}
              </div>
            </div>

            {/* Applications over time */}
            <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm">
              <h2 className="text-sm font-bold text-zinc-800 mb-4">Applications per Week</h2>
              <div className="flex items-end gap-2 h-36">
                {weeks.map((w) => (
                  <div key={w.label} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-zinc-500">{w.count > 0 ? w.count : ""}</span>
                    <motion.div
                      className="w-full bg-indigo-400 rounded-t-lg"
                      initial={{ height: 0 }}
                      animate={{ height: `${(w.count / maxWeek) * 100}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      style={{ minHeight: w.count > 0 ? "4px" : "2px" }}
                    />
                    <span className="text-[9px] text-zinc-400">{w.label}</span>
                  </div>
                ))}
              </div>
              {weeks.every(w => w.count === 0) && (
                <p className="text-xs text-zinc-400 text-center mt-4">No applied jobs tracked yet.</p>
              )}
            </div>

            {/* Top Companies */}
            {topCompanies.length > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm">
                <h2 className="text-sm font-bold text-zinc-800 mb-4">Top Companies Applied To</h2>
                <div className="space-y-3">
                  {topCompanies.map(([company, count]) => (
                    <div key={company} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-600 shrink-0">
                        {company[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-700 truncate">{company}</p>
                        <div className="w-full bg-zinc-100 rounded-full h-1.5 mt-1">
                          <motion.div className="h-full bg-indigo-400 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${(count / topCompanies[0][1]) * 100}%` }}
                            transition={{ duration: 0.6 }} />
                        </div>
                      </div>
                      <span className="text-xs font-bold text-zinc-500 shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Priority dist */}
            <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm">
              <h2 className="text-sm font-bold text-zinc-800 mb-4">Application Priority</h2>
              <div className="space-y-3">
                {priorities.map(({ label, count }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className={`text-xs font-bold capitalize w-16 ${label === "high" ? "text-red-500" : label === "medium" ? "text-amber-500" : "text-zinc-400"}`}>{label}</span>
                    <div className="flex-1 bg-zinc-100 rounded-full h-6 relative overflow-hidden">
                      <motion.div className={`h-full rounded-full ${label === "high" ? "bg-red-400" : label === "medium" ? "bg-amber-400" : "bg-zinc-300"}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${applications.length > 0 ? (count / applications.length) * 100 : 0}%` }}
                        transition={{ duration: 0.6 }} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-600">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
