"use client";

import { useTraffic } from "@/hooks/useTraffic";

function Bar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-0 flex-1 truncate text-xs text-text" title={label}>
        {label}
      </span>
      <span className="relative h-1.5 w-24 overflow-hidden rounded-full bg-surface-2">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-brand-500"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="w-10 text-right text-xs font-bold tabular-nums text-secondary">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

/**
 * Live site traffic on the Overview.
 *
 * Counted from our own page-view table, not from GA4 — the analytics tags in
 * Settings report to Google and Meta, so their numbers never reach this admin.
 * Being same-origin, these also survive the ad blockers that eat GA, so they
 * usually read a little HIGHER than Google's for the same day.
 */
export function TrafficPanel() {
  const { data, isLoading, isError } = useTraffic();

  if (isError) {
    return (
      <div className="rounded-card border border-border bg-surface p-5 shadow-card">
        <p className="text-sm text-muted">Traffic is unavailable right now.</p>
      </div>
    );
  }

  const t = data;
  const yesterday = t?.visitorsYesterday ?? 0;
  const today = t?.visitorsToday ?? 0;
  // Yesterday's full day against today's partial one, so it is a direction,
  // not a verdict — said plainly in the label rather than dressed up as a KPI.
  const delta = yesterday > 0 ? Math.round(((today - yesterday) / yesterday) * 100) : null;

  const maxPage = Math.max(1, ...(t?.topPages ?? []).map((p) => p.views));
  const maxSource = Math.max(1, ...(t?.topSources ?? []).map((s) => s.views));

  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="font-ui text-base font-extrabold text-text">
          Site Traffic
        </div>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          live
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-inner bg-surface-2 p-3">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-muted">
            On site now
          </span>
          <strong className="mt-1 block text-2xl tabular-nums text-text">
            {isLoading ? "—" : t?.liveVisitors.toLocaleString()}
          </strong>
          <span className="text-[10px] text-muted">
            last {t?.liveWindowMinutes ?? 5} min
          </span>
        </div>
        <div className="rounded-inner bg-surface-2 p-3">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-muted">
            Visitors today
          </span>
          <strong className="mt-1 block text-2xl tabular-nums text-text">
            {isLoading ? "—" : today.toLocaleString()}
          </strong>
          <span className="text-[10px] text-muted">
            {delta === null
              ? "no data yesterday"
              : `${delta >= 0 ? "+" : ""}${delta}% vs all of yesterday`}
          </span>
        </div>
        <div className="rounded-inner bg-surface-2 p-3">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-muted">
            Page views today
          </span>
          <strong className="mt-1 block text-2xl tabular-nums text-text">
            {isLoading ? "—" : t?.viewsToday.toLocaleString()}
          </strong>
          <span className="text-[10px] text-muted">
            {today > 0 ? `${((t?.viewsToday ?? 0) / today).toFixed(1)} per visitor` : "—"}
          </span>
        </div>
      </div>

      {!isLoading && (t?.viewsToday ?? 0) === 0 ? (
        <p className="mt-4 text-xs leading-relaxed text-muted">
          No page views recorded yet today. Traffic is counted by a beacon on
          the storefront, so figures start from the moment it was deployed —
          there is no history before that.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
              Top pages today
            </div>
            <div className="flex flex-col gap-1.5">
              {(t?.topPages ?? []).map((p) => (
                <Bar key={p.path} label={p.path} value={p.views} max={maxPage} />
              ))}
              {!isLoading && (t?.topPages ?? []).length === 0 && (
                <span className="text-xs text-muted">—</span>
              )}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
              Top sources today
            </div>
            <div className="flex flex-col gap-1.5">
              {(t?.topSources ?? []).map((s) => (
                <Bar
                  key={s.source}
                  label={s.source}
                  value={s.views}
                  max={maxSource}
                />
              ))}
              {!isLoading && (t?.topSources ?? []).length === 0 && (
                <span className="text-xs text-muted">—</span>
              )}
            </div>
          </div>
        </div>
      )}

      {(t?.devices ?? []).length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
          {(t?.devices ?? []).map((d) => (
            <span
              key={d.device}
              className="rounded-pill bg-surface-2 px-2.5 py-1 text-[10px] font-bold capitalize text-secondary"
            >
              {d.device} · {d.views.toLocaleString()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
