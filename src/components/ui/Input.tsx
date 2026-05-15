"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

type FieldVariant = "default" | "compact";

interface BaseProps {
  label?: string;
  hint?: React.ReactNode;
  error?: string;
  fieldVariant?: FieldVariant;
}

export interface InputProps
  extends BaseProps,
    React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, className, fieldVariant = "default", ...rest }, ref) => {
    return (
      <label className="block w-full">
        {label && (
          <span className="block text-[11px] uppercase tracking-wider font-bold text-zinc-500 mb-1.5">
            {label}
          </span>
        )}
        <input
          ref={ref}
          {...rest}
          className={cn(
            "w-full rounded-xl border border-zinc-200 bg-zinc-50 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:text-zinc-400 disabled:bg-zinc-100 disabled:text-zinc-400",
            fieldVariant === "default" ? "px-4 py-2.5 text-sm" : "px-3 py-2 text-xs",
            error && "border-red-300 focus:ring-red-500/20 focus:border-red-500",
            className
          )}
        />
        {hint && !error && (
          <span className="block mt-1 text-[11px] text-zinc-500">{hint}</span>
        )}
        {error && (
          <span className="block mt-1 text-[11px] font-semibold text-red-600">{error}</span>
        )}
      </label>
    );
  }
);
Input.displayName = "Input";

export interface TextareaProps
  extends BaseProps,
    React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, className, fieldVariant = "default", ...rest }, ref) => {
    return (
      <label className="block w-full">
        {label && (
          <span className="block text-[11px] uppercase tracking-wider font-bold text-zinc-500 mb-1.5">
            {label}
          </span>
        )}
        <textarea
          ref={ref}
          {...rest}
          className={cn(
            "w-full rounded-xl border border-zinc-200 bg-zinc-50 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:text-zinc-400",
            fieldVariant === "default" ? "px-4 py-3 text-sm" : "px-3 py-2 text-xs",
            error && "border-red-300 focus:ring-red-500/20 focus:border-red-500",
            className
          )}
        />
        {hint && !error && (
          <span className="block mt-1 text-[11px] text-zinc-500">{hint}</span>
        )}
        {error && (
          <span className="block mt-1 text-[11px] font-semibold text-red-600">{error}</span>
        )}
      </label>
    );
  }
);
Textarea.displayName = "Textarea";
