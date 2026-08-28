"use client";

import React from "react";

const GREEN = "#2e7d43";
const GREEN_SOFT = "#e8f4ea";
const GREEN_SOFT_2 = "#dff0e2";
const INK = "#1e2b22";
const MUTED = "#64766b";

const cartIcon = (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="21" r="1" />
    <circle cx="19" cy="21" r="1" />
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
  </svg>
);

const percentIcon = (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="5" x2="5" y2="19" />
    <circle cx="6.5" cy="6.5" r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </svg>
);

const takaIcon = (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="14" x="2" y="5" rx="2" />
    <line x1="2" x2="22" y1="10" y2="10" />
  </svg>
);

const pendingIcon = (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const campaignIcon = (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </svg>
);

function Stat({ label, value, icon, sub }: { label: string; value: string; icon: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-card border p-[17px_19px] shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: "#e5ebe6" }}>
      <div>
        <div className="text-[0.75rem] font-semibold" style={{ color: MUTED }}>
          {label}
        </div>
        <div className="mt-[7px] text-[1.42rem] font-extrabold tracking-tight" style={{ color: INK }}>
          {value}
        </div>
        {sub && <div className="mt-1 text-[0.68rem] font-semibold text-secondary">{sub}</div>}
      </div>
      <div className="grid h-12 w-12 flex-none place-items-center rounded-full border" style={{ background: GREEN_SOFT, color: GREEN, borderColor: GREEN_SOFT_2 }}>
        {icon}
      </div>
    </div>
  );
}

export function RecoveryStatsStrip({
  total,
  ratePercent,
  recoveredValue,
  pendingCount,
  campaignEnabled,
}: {
  total: number;
  ratePercent: number;
  recoveredValue: string | number;
  pendingCount?: number;
  campaignEnabled?: boolean;
}) {
  const formattedValue = typeof recoveredValue === "number" ? `৳${recoveredValue.toLocaleString()}` : `৳${Number(recoveredValue || 0).toLocaleString()}`;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <Stat label="Abandoned Carts" value={total.toLocaleString()} icon={cartIcon} />
      <Stat label="Recovery Rate" value={`${ratePercent}%`} icon={percentIcon} />
      <Stat label="Recovered Value" value={formattedValue} icon={takaIcon} />
      <Stat label="Pending Recovery" value={(pendingCount ?? Math.max(0, total - Math.round(total * (ratePercent / 100)))).toLocaleString()} icon={pendingIcon} />
      <Stat label="Auto Campaign" value={campaignEnabled ? "Active" : "Paused"} sub="5-min win-back worker" icon={campaignIcon} />
    </div>
  );
}
