import React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "indigo" | "emerald" | "amber" | "red" | "violet" | "blue";

const toneStyles: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-zinc-700",
  indigo: "bg-indigo-100 text-indigo-700",
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-600",
  violet: "bg-violet-100 text-violet-700",
  blue: "bg-blue-100 text-blue-700",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
        toneStyles[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const safe = Math.max(0, Math.min(100, score));
  const color =
    safe >= 75 ? "#10b981" : safe >= 50 ? "#f59e0b" : "#ef4444";
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="transparent"
        stroke="#e4e4e7"
        strokeWidth={4}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="transparent"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        className="rotate-90 origin-center"
        style={{ fontSize: size / 3, fontWeight: 900, fill: color }}
      >
        {safe}
      </text>
    </svg>
  );
}
