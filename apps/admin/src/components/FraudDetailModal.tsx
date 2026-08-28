"use client";

import { Modal, RiskBadge } from "@amader/admin-ui";
import type { RiskLevel as RiskBadgeLevel } from "@amader/admin-ui";
import { useFraudCheck, useRecheckFraud } from "@/hooks/useFraud";

const GREEN = "#2e7d43";
const LINE = "#e5ebe6";
const INK = "#1e2b22";
const MUTED = "#64766b";
const TEXT = "#374840";
const FAINT = "#94a69a";

interface CourierStat {
  provider: string;
  total: number;
  delivered: number;
  cancelled: number;
  ratePercent: number;
}

function parseBreakdown(raw: unknown): CourierStat[] {
  if (!raw || typeof raw !== "object") return [];

  const list: CourierStat[] = [];

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === "object") {
        const provider = String(item.provider || item.courier || item.name || "Courier");
        const total = Number(item.total || item.totalOrders || 0);
        const delivered = Number(item.delivered || 0);
        const cancelled = Number(item.cancelled || item.returned || 0);
        const ratePercent = total > 0 ? (delivered / total) * 100 : 0;
        list.push({ provider, total, delivered, cancelled, ratePercent });
      }
    }
  } else {
    for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
      if (val && typeof val === "object") {
        const obj = val as Record<string, unknown>;
        const total = Number(obj.total || obj.totalOrders || 0);
        const delivered = Number(obj.delivered || 0);
        const cancelled = Number(obj.cancelled || obj.returned || 0);
        const ratePercent = total > 0 ? (delivered / total) * 100 : 0;
        list.push({ provider: key, total, delivered, cancelled, ratePercent });
      } else if (typeof val === "number") {
        list.push({ provider: key, total: val, delivered: val, cancelled: 0, ratePercent: 100 });
      }
    }
  }

  return list;
}

export function FraudDetailModal({ phone, onClose }: { phone: string; onClose: () => void }) {
  const { data: check, isLoading, isError } = useFraudCheck(phone);
  const recheck = useRecheckFraud();

  const successRatePercent = check?.successRate !== null && check?.successRate !== undefined ? check.successRate * 100 : null;
  const breakdownStats = check ? parseBreakdown(check.breakdown) : [];

  return (
    <Modal open onClose={onClose} title={`Courier Intelligence: ${phone}`} className="max-w-lg">
      {isLoading && (
        <div className="py-8 text-center text-sm font-semibold" style={{ color: FAINT }}>
          Querying courier delivery databases for {phone}…
        </div>
      )}

      {isError && (
        <div className="rounded-card border p-4 text-xs font-semibold text-rose-700 bg-rose-500/10" style={{ borderColor: "#fcdde0" }}>
          No courier delivery data available for this phone number — Fraud Checker may be disabled or this customer has no history recorded yet.
        </div>
      )}

      {check && (
        <div className="flex flex-col gap-4">
          {/* Header Summary Card */}
          <div className="flex items-center justify-between gap-3 rounded-card border p-3.5" style={{ background: "#f8fbf9", borderColor: LINE }}>
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-[#1e2b22] text-base">{phone}</span>
                <RiskBadge level={check.riskLevel as RiskBadgeLevel} />
              </div>
              <span className="text-[0.72rem] font-semibold text-secondary">
                Checked: {new Date(check.checkedAt).toLocaleString()} · Source: <span className="font-bold text-text uppercase">{check.source}</span>
              </span>
            </div>
            {successRatePercent !== null && (
              <div className="flex flex-col items-end shrink-0">
                <span className="text-[0.68rem] font-semibold text-secondary">Success Rate</span>
                <span className={`text-[1.2rem] font-extrabold ${successRatePercent >= 80 ? "text-emerald-700" : successRatePercent >= 50 ? "text-amber-700" : "text-rose-700"}`}>
                  {successRatePercent.toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {/* Key Metrics Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col rounded-card border p-3 text-center" style={{ background: "#fff", borderColor: LINE }}>
              <span className="text-[0.68rem] font-bold text-secondary">Total Orders</span>
              <span className="mt-1 text-[1.2rem] font-extrabold text-text">{check.totalOrders}</span>
            </div>
            <div className="flex flex-col rounded-card border p-3 text-center" style={{ background: "#fff", borderColor: LINE }}>
              <span className="text-[0.68rem] font-bold text-secondary">Delivered</span>
              <span className="mt-1 text-[1.2rem] font-extrabold text-emerald-700">{check.delivered}</span>
            </div>
            <div className="flex flex-col rounded-card border p-3 text-center" style={{ background: "#fff", borderColor: LINE }}>
              <span className="text-[0.68rem] font-bold text-secondary">Cancelled / Returned</span>
              <span className="mt-1 text-[1.2rem] font-extrabold text-rose-700">{check.cancelled}</span>
            </div>
          </div>

          {/* Success Rate Progress Bar */}
          {successRatePercent !== null && (
            <div className="flex flex-col gap-1.5 rounded-card border p-3" style={{ background: "#fff", borderColor: LINE }}>
              <div className="flex items-center justify-between text-[0.72rem] font-bold">
                <span style={{ color: INK }}>Overall Delivery Success Rate</span>
                <span style={{ color: MUTED }}>{check.delivered} of {check.totalOrders} orders</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-pill bg-surface-2">
                <div
                  className={`h-full rounded-pill transition-all ${
                    successRatePercent >= 80 ? "bg-emerald-600" : successRatePercent >= 50 ? "bg-amber-500" : "bg-rose-600"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, successRatePercent))}%` }}
                />
              </div>
            </div>
          )}

          {/* Courier Breakdown Cards */}
          <div className="flex flex-col gap-2 rounded-card border p-3.5" style={{ background: "#fff", borderColor: LINE }}>
            <span className="text-[0.74rem] font-bold text-text">Per-Courier Delivery Breakdown</span>
            {breakdownStats.length > 0 ? (
              <div className="flex flex-col gap-2.5 max-h-48 overflow-auto">
                {breakdownStats.map((c) => (
                  <div key={c.provider} className="flex flex-col gap-1 rounded-inner border bg-surface p-2.5" style={{ borderColor: LINE }}>
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-text">{c.provider}</span>
                      <span className="text-secondary">
                        {c.delivered} delivered / {c.cancelled} cancelled ({c.total} total)
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-2">
                      <div
                        className="h-full rounded-pill bg-[#2e7d43]"
                        style={{ width: `${Math.min(100, Math.max(0, c.ratePercent))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-secondary py-1">
                No courier-specific breakdown details recorded for this profile.
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="mt-1 flex items-center justify-between border-t pt-3" style={{ borderColor: LINE }}>
            <span className="text-[0.68rem] text-secondary">
              Expires: {new Date(check.expiresAt).toLocaleString()}
            </span>
            <button
              type="button"
              disabled={recheck.isPending}
              onClick={() => recheck.mutate(phone)}
              className="inline-flex h-9 items-center gap-2 rounded-[9px] px-4 text-[0.76rem] font-bold text-white shadow-sm disabled:opacity-40"
              style={{ background: GREEN }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={recheck.isPending ? "animate-spin" : ""}>
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              {recheck.isPending ? "Rechecking…" : "Re-check Courier History"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
