"use client";

// Analytics: response rate, offer rate, source mix, applications-per-week,
// status distribution. Uses recharts.

import React, { useMemo } from "react";
import { useMounted } from "@/lib/useMounted";
import {
  BarChart3, TrendingUp, Send, Target, Mic, Trophy,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid,
} from "recharts";

import { useTrackerStore } from "@/store/trackerStore";
import type { ApplicationStatus } from "@/types";
import { Card, CardHeader, CardBody, Badge } from "@/components/ui";

const STATUS_COLOR: Record<ApplicationStatus, string> = {
  saved: "#a1a1aa",
  applied: "#60a5fa",
  screening: "#f59e0b",
  interview: "#8b5cf6",
  offer: "#10b981",
  rejected: "#ef4444",
  withdrawn: "#71717a",
};

function StatCard({
  label, value, icon: Icon, sub, color,
}: {
  label: string; value: string | number; icon: React.ElementType; sub?: string; color: string;
}) {
  return (
    <Card>
      <CardBody>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <p className="text-2xl font-black text-zinc-900">{value}</p>
        <p className="text-sm font-semibold text-zinc-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-zinc-400 mt-1">{sub}</p>}
      </CardBody>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { applications, getStats } = useTrackerStore();
  const mounted = useMounted();
  const stats = getStats();

  const sourceData = useMemo(() => {
    const map = new Map<string, number>();
    applications.forEach((a) => {
      const k = a.source || "manual";
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map.entries()).map(([source, count]) => ({ source, count }));
  }, [applications]);

  const statusData = useMemo(() => {
    const order: ApplicationStatus[] = ["saved", "applied", "screening", "interview", "offer", "rejected"];
    return order.map((status) => ({
      status,
      label: status[0].toUpperCase() + status.slice(1),
      count: applications.filter((a) => a.status === status).length,
      color: STATUS_COLOR[status],
    }));
  }, [applications]);

  const weeklyData = useMemo(() => {
    const buckets = new Map<string, { saved: number; applied: number }>();
    const fmt = (ts: number) => {
      const d = new Date(ts);
      // ISO week-ish: YYYY-Www
      const onejan = new Date(d.getFullYear(), 0, 1);
      const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
      return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
    };
    applications.forEach((a) => {
      const sKey = fmt(a.savedDate);
      const bucket = buckets.get(sKey) ?? { saved: 0, applied: 0 };
      bucket.saved += 1;
      if (a.appliedDate) bucket.applied += 1;
      buckets.set(sKey, bucket);
    });
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([week, v]) => ({ week, ...v }));
  }, [applications]);

  if (!mounted) return null;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-black text-zinc-900">Analytics</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Track conversion rates, source mix, and pipeline health over time.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Response rate"
          value={`${stats.responseRate}%`}
          icon={TrendingUp}
          color="bg-emerald-50 text-emerald-600"
          sub={`${stats.applied} applications`}
        />
        <StatCard
          label="Offer rate"
          value={`${stats.offerRate}%`}
          icon={Trophy}
          color="bg-amber-50 text-amber-600"
          sub={`${stats.offers} offers`}
        />
        <StatCard
          label="Interviewing"
          value={stats.interviewing}
          icon={Mic}
          color="bg-violet-50 text-violet-600"
          sub="active rounds"
        />
        <StatCard
          label="Rejected"
          value={stats.rejected}
          icon={Target}
          color="bg-red-50 text-red-600"
          sub="closed out"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-bold text-zinc-800">Status distribution</span>
            </div>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis dataKey="label" fontSize={12} stroke="#a1a1aa" />
                <YAxis allowDecimals={false} fontSize={12} stroke="#a1a1aa" />
                <Tooltip cursor={{ fill: "#f4f4f5" }} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {statusData.map((s) => (
                    <Cell key={s.status} fill={s.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-violet-500" />
              <span className="text-sm font-bold text-zinc-800">Source mix</span>
            </div>
          </CardHeader>
          <CardBody>
            {sourceData.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-8">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={sourceData}
                    dataKey="count"
                    nameKey="source"
                    outerRadius={80}
                    label
                  >
                    {sourceData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#0ea5e9"][i % 6]}
                      />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-bold text-zinc-800">Activity by week</span>
            </div>
          </CardHeader>
          <CardBody>
            {weeklyData.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-8">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                  <XAxis dataKey="week" fontSize={11} stroke="#a1a1aa" />
                  <YAxis allowDecimals={false} fontSize={12} stroke="#a1a1aa" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="saved" stroke="#a1a1aa" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="applied" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
