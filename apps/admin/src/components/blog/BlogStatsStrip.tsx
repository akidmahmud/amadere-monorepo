"use client";

import type { BlogPostStats } from "@/hooks/useBlogPosts";

function icon(paths: React.ReactNode) {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {paths}
    </svg>
  );
}

const TILES: { key: keyof BlogPostStats; label: string; bg: string; fg: string; icon: React.ReactNode }[] = [
  {
    key: "total",
    label: "Total Posts",
    bg: "var(--stat-blue-bg)",
    fg: "var(--stat-blue)",
    icon: icon(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" /></>),
  },
  {
    key: "published",
    label: "Published",
    bg: "var(--stat-green-bg)",
    fg: "var(--stat-green)",
    icon: icon(<><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>),
  },
  {
    key: "draft",
    label: "Drafts",
    bg: "var(--stat-purple-bg)",
    fg: "var(--stat-purple)",
    icon: icon(<><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></>),
  },
  {
    key: "archived",
    label: "Archived",
    bg: "var(--surface-2)",
    fg: "var(--muted)",
    icon: icon(<><rect x="2" y="4" width="20" height="5" rx="1" /><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" /><line x1="10" y1="13" x2="14" y2="13" /></>),
  },
  {
    key: "featured",
    label: "Featured",
    bg: "var(--stat-yellow-bg)",
    fg: "var(--stat-yellow)",
    icon: icon(<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />),
  },
];

export function BlogStatsStrip({ stats }: { stats?: BlogPostStats }) {
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
