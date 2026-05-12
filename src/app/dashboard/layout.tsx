"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Kanban, FileText, Sparkles, Users,
  BarChart3, Settings, Menu, X, Zap, ChevronRight,
  ExternalLink, Briefcase
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/tracker", label: "Job Tracker", icon: Kanban },
  { href: "/dashboard/resume", label: "ATS Optimizer", icon: FileText },
  { href: "/dashboard/ai", label: "AI Toolkit", icon: Sparkles },
  { href: "/dashboard/contacts", label: "Contacts", icon: Users },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function NavItem({ href, label, icon: Icon, active, onClick }: {
  href: string; label: string; icon: React.ElementType; active: boolean; onClick?: () => void;
}) {
  return (
    <Link href={href} onClick={onClick}>
      <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group relative
        ${active
          ? "bg-indigo-500/20 text-indigo-300 shadow-sm"
          : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
        }`}
      >
        <Icon size={18} className={`shrink-0 transition-colors ${active ? "text-indigo-400" : "group-hover:text-zinc-200"}`} />
        <span>{label}</span>
        {active && (
          <motion.div
            layoutId="nav-indicator"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-400 rounded-full -ml-0.5"
          />
        )}
      </div>
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-50 w-64 flex flex-col
        bg-zinc-900 border-r border-zinc-800
        transition-transform duration-300 lg:translate-x-0
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-lg flex items-center justify-center shadow-lg">
              <Briefcase size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-black text-white leading-none">ReferMe</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Personal Dashboard</p>
            </div>
          </div>
          <button className="lg:hidden text-zinc-500 hover:text-zinc-300" onClick={() => setMobileOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              active={isActive(item.href)}
              onClick={() => setMobileOpen(false)}
            />
          ))}
        </nav>

        {/* Extension link */}
        <div className="px-3 py-4 border-t border-zinc-800">
          <Link href="/" target="_blank">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all group">
              <Zap size={16} className="text-violet-500 shrink-0" />
              <span>Open Extension</span>
              <ExternalLink size={12} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
          <button onClick={() => setMobileOpen(true)} className="text-zinc-400 hover:text-white">
            <Menu size={20} />
          </button>
          <p className="text-sm font-black text-white">ReferMe</p>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-zinc-50">
          {children}
        </main>
      </div>
    </div>
  );
}
