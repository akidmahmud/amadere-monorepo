"use client";

import React, { useState } from "react";

const LINE = "#e5ebe6";
const MUTED = "#64766b";
const GREEN = "#2e7d43";

export type RangeKey = "today" | "yesterday" | "7d" | "month" | "year" | "all" | "custom";

export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 Days" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
];

export function resolveRange(key: RangeKey, customFrom: string, customTo: string): { from: Date; to: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  switch (key) {
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "7d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
    case "year":
      return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
    case "all":
      return { from: new Date(2000, 0, 1), to: endOfDay(now) };
    case "custom":
      return {
        from: customFrom ? startOfDay(new Date(customFrom)) : startOfDay(now),
        to: customTo ? endOfDay(new Date(customTo)) : endOfDay(now),
      };
    default:
      return { from: startOfDay(now), to: endOfDay(now) };
  }
}

export function ReportsFilterBar({
  rangeKey,
  setRangeKey,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
  exportParams,
}: {
  rangeKey: RangeKey;
  setRangeKey: (r: RangeKey) => void;
  customFrom: string;
  setCustomFrom: (v: string) => void;
  customTo: string;
  setCustomTo: (v: string) => void;
  exportParams: URLSearchParams;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const activeLabel = rangeKey === "custom" ? "Custom" : RANGE_OPTIONS.find((r) => r.value === rangeKey)?.label;

  return (
    <div className="flex flex-col gap-3 rounded-card border p-[14px_16px] shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span className="text-[0.76rem] font-bold" style={{ color: "#374840" }}>
            Date Filter:
          </span>
          <span className="rounded-pill px-3 py-1 text-[0.72rem] font-bold text-white shadow-sm" style={{ background: GREEN }}>
            {activeLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/api/backend/admin/net-profit/reports/sales/export?${exportParams.toString()}`} download className="inline-flex">
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border px-3 text-[0.75rem] font-bold transition-colors hover:bg-surface-2"
              style={{ borderColor: LINE, color: "#374840" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </button>
          </a>
          <a href={`/api/backend/admin/net-profit/reports/sales/export.html?${exportParams.toString()}`} download className="inline-flex">
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border px-3 text-[0.75rem] font-bold transition-colors hover:bg-surface-2"
              style={{ borderColor: LINE, color: "#374840" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              Export HTML
            </button>
          </a>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: LINE }}>
        {RANGE_OPTIONS.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => {
              setRangeKey(r.value);
              setShowCustom(false);
            }}
            className="rounded-pill px-3 py-1.5 text-[0.74rem] font-bold transition-all"
            style={
              rangeKey === r.value
                ? { background: GREEN, color: "#fff" }
                : { background: "#f2f6f3", color: MUTED }
            }
          >
            {r.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setRangeKey("custom");
            setShowCustom((v) => !v);
          }}
          className="ml-auto inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-[0.74rem] font-bold transition-all"
          style={
            rangeKey === "custom"
              ? { background: GREEN, color: "#fff" }
              : { background: "#f2f6f3", color: MUTED }
          }
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Custom Date Range
        </button>
      </div>

      {showCustom && (
        <div className="flex flex-wrap items-end gap-3 border-t pt-3" style={{ borderColor: LINE }}>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.72rem] font-bold" style={{ color: MUTED }}>
              From Date
            </span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-9 rounded-[9px] border bg-white px-3 text-[0.76rem] outline-none"
              style={{ borderColor: LINE, color: "#374840" }}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.72rem] font-bold" style={{ color: MUTED }}>
              To Date
            </span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-9 rounded-[9px] border bg-white px-3 text-[0.76rem] outline-none"
              style={{ borderColor: LINE, color: "#374840" }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
