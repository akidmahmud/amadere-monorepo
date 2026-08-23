"use client";

import type { ReactNode } from "react";
import { Card } from "@amader/admin-ui";
import type { AgeingBucket } from "@/hooks/useAccounts";

/** Money always arrives as a 2dp decimal string; never parse it to a float
 *  for arithmetic, only for display grouping. */
export function money(value: string | undefined | null): string {
  const n = Number(value ?? 0);
  return `৳${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function firstOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export const BUCKET_LABEL: Record<AgeingBucket, string> = {
  CURRENT: "Not yet due",
  "1_30": "1–30 days",
  "31_60": "31–60 days",
  "60_PLUS": "Over 60 days",
};

export const BUCKET_ORDER: AgeingBucket[] = [
  "CURRENT",
  "1_30",
  "31_60",
  "60_PLUS",
];

export function SectionCard({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-secondary">{subtitle}</p>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </Card>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "PAID"
      ? "bg-success/10 text-success"
      : status === "PARTIAL" || status === "PARTIALLY_PAID"
        ? "bg-warning/10 text-warning"
        : "bg-danger/10 text-danger";
  const label =
    status === "PARTIALLY_PAID"
      ? "Partial"
      : status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}
    >
      {label}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-secondary">{children}</p>;
}
