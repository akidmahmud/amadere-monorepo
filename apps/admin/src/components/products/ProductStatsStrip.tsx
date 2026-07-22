"use client";

import type { ProductStats } from "@/hooks/useProducts";

function icon(paths: React.ReactNode) {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {paths}
    </svg>
  );
}

const TILES: {
  key: keyof ProductStats;
  label: string;
  bg: string;
  fg: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "total",
    label: "Total Products",
    bg: "var(--stat-blue-bg)",
    fg: "var(--stat-blue)",
    icon: icon(<><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></>),
  },
  {
    key: "active",
    label: "Active Products",
    bg: "var(--stat-green-bg)",
    fg: "var(--stat-green)",
    icon: icon(<><rect x="3" y="3" width="18" height="18" rx="4" /><path d="m9 12 2 2 4-4" /></>),
  },
  {
    key: "draft",
    label: "Draft Products",
    bg: "var(--stat-purple-bg)",
    fg: "var(--stat-purple)",
    icon: icon(<><rect x="3" y="3" width="18" height="18" rx="4" /><path d="m14 8.5 1.5 1.5L10 15.5H8.5V14Z" /></>),
  },
  {
    key: "outOfStock",
    label: "Out of Stock",
    bg: "var(--stat-red-bg)",
    fg: "var(--stat-red)",
    icon: icon(<><rect x="3" y="7" width="18" height="14" rx="3" /><path d="M8 7V6a4 4 0 0 1 8 0v1" /><path d="m10.5 12.5 3 3" /><path d="m13.5 12.5-3 3" /></>),
  },
  {
    key: "lowStock",
    label: "Low Stock",
    bg: "var(--stat-yellow-bg)",
    fg: "var(--stat-yellow)",
    icon: icon(<><rect x="3" y="7" width="18" height="14" rx="3" /><path d="M8 7V6a4 4 0 0 1 8 0v1" /><path d="M12 11v3" /><path d="M12 17h.01" /></>),
  },
];

export function ProductStatsStrip({ stats }: { stats?: ProductStats }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {TILES.map((t) => (
        <div key={t.key} className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface p-[15px_18px] shadow-card">
          <div>
            <div className="text-[0.76rem] font-semibold text-secondary">{t.label}</div>
            <div className="mt-1 text-[1.3rem] font-extrabold text-text">{stats ? stats[t.key] : "—"}</div>
          </div>
          <div className="grid h-10 w-10 flex-none place-items-center rounded-inner" style={{ background: t.bg, color: t.fg }}>
            {t.icon}
          </div>
        </div>
      ))}
    </div>
  );
}
