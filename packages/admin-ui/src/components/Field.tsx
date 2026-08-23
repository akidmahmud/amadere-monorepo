"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface FieldProps {
  label: string;
  /** Shown in place of the hint, in the danger colour. */
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  /** The raw control — apply `fieldInputClass` to it. */
  children: ReactNode;
}

/**
 * Shared styling for inputs and selects inside a Field. Applied by the caller
 * rather than cloned onto the child, so a control can extend or override it
 * (a narrow amount box, a full-width note) without fighting the wrapper.
 */
export const fieldInputClass =
  "h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500 disabled:opacity-60";

/**
 * Labelled form control. Exists because the accounts forms alone carry ~40
 * inputs that were each repeating the same class string and label markup.
 */
export function Field({ label, error, hint, required, className, children }: FieldProps) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-semibold text-secondary">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </span>
      {children}
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="text-xs text-secondary">{hint}</span>
      ) : null}
    </label>
  );
}
