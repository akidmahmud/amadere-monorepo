"use client";

import React from "react";

const INK = "#1e2b22";
const MUTED = "#64766b";

const revenueIcon = (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="14" x="2" y="5" rx="2" />
    <line x1="2" x2="22" y1="10" y2="10" />
  </svg>
);

const buyCostIcon = (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="m7.5 4.27 9 5.15" />
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5" />
    <path d="M12 12v9.5" />
  </svg>
);

const adsIcon = (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 11 18-5v12L3 13v-2z" />
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
  </svg>
);

const shippingIcon = (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13" />
    <path d="M16 8h4l3 3v5h-7V8Z" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const profitIcon = (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

function Stat({
  label,
  value,
  icon,
  bgColor,
  color,
  borderColor,
  badge,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  bgColor: string;
  color: string;
  borderColor: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-card border p-[17px_19px] shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: "#e5ebe6" }}>
      <div>
        <div className="text-[0.75rem] font-semibold" style={{ color: MUTED }}>
          {label}
        </div>
        <div className="mt-[7px] text-[1.42rem] font-extrabold tracking-tight" style={{ color: INK }}>
          {value}
        </div>
        {badge && <div className="mt-1.5">{badge}</div>}
      </div>
      <div className="grid h-12 w-12 flex-none place-items-center rounded-full border" style={{ background: bgColor, color, borderColor }}>
        {icon}
      </div>
    </div>
  );
}

export function ReportsStatsStrip({
  revenue,
  cogs,
  adSpend,
  shipping,
  netProfit,
  marginPercent,
}: {
  revenue: number;
  cogs: number;
  adSpend: number;
  shipping: number;
  netProfit: number;
  marginPercent: number;
}) {
  const fmt = (n: number) => `৳${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <Stat label="Total Revenue" value={fmt(revenue)} icon={revenueIcon} bgColor="#e8f4ea" color="#2e7d43" borderColor="#dff0e2" />
      <Stat label="Buy Cost (COGS)" value={fmt(cogs)} icon={buyCostIcon} bgColor="#feeef0" color="#e5484d" borderColor="#fcdde0" />
      <Stat label="Ads Cost" value={fmt(adSpend)} icon={adsIcon} bgColor="#fff8e6" color="#d97706" borderColor="#feeed0" />
      <Stat label="Shipping" value={fmt(shipping)} icon={shippingIcon} bgColor="#e6f4ff" color="#0c8ce9" borderColor="#cce7ff" />
      <Stat
        label="Net Profit"
        value={fmt(netProfit)}
        icon={profitIcon}
        bgColor={netProfit >= 0 ? "#e8f4ea" : "#feeef0"}
        color={netProfit >= 0 ? "#2e7d43" : "#e5484d"}
        borderColor={netProfit >= 0 ? "#dff0e2" : "#fcdde0"}
        badge={
          <span className={`inline-block rounded-pill px-2.5 py-0.5 text-xs font-bold ${netProfit >= 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
            {marginPercent}% margin
          </span>
        }
      />
    </div>
  );
}
