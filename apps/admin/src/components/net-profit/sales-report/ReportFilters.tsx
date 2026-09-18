"use client";
import type { ReportFilters as F, FilterOptions } from "@/hooks/useSalesReportV2";
import { COLORS, courierLabel, dmy } from "./format";
import { quickRanges } from "./useReportFilters";

export type ExportRows = (string | number | null | undefined)[][];

export interface TabProps {
  f: F;
  setFilters: (p: Partial<F> & { tab?: string; q?: string; open?: string }) => void;
  money: boolean;
  /** Rows now, or a loader the Export button awaits (e.g. every order, unpaged). */
  onExport: (name: string, rows: ExportRows | (() => Promise<ExportRows>) | null) => void;
}

const STATUSES = ["Pending", "Confirmed", "Shipped", "Delivered", "Returned", "Cancelled"];
const ctl = "min-h-[34px] rounded-[7px] border bg-white px-2 text-sm";

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg border bg-white p-0.5" style={{ borderColor: COLORS.line }}>
      {options.map(([k, l]) => (
        <button
          key={k}
          type="button"
          aria-pressed={value === k}
          onClick={() => onChange(k)}
          className="whitespace-nowrap rounded-md px-3 py-1 text-sm"
          style={value === k ? { background: COLORS.green, color: "#fff" } : { color: COLORS.ink2 }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function ReportFilters({ f, set, reset, options, showAgent }: {
  f: F;
  set: (p: Partial<F>) => void;
  reset: () => void;
  options?: FilterOptions;
  showAgent: boolean;
}) {
  const select = (key: keyof F, label: string, opts: [string, string][]) => (
    <select aria-label={label} className={`${ctl} min-w-[128px]`} style={{ borderColor: COLORS.line }} value={f[key]} onChange={(e) => set({ [key]: e.target.value })}>
      <option value="all">{label}</option>
      {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
  return (
    <section aria-label="Filters" className="grid gap-2.5 rounded-xl border bg-white px-3.5 py-3" style={{ borderColor: COLORS.line }}>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px]" style={{ color: COLORS.muted }}>Count orders by</span>
          <Seg value={f.basis} options={[["order", "Order date"], ["delivered", "Delivered date"]]} onChange={(v) => set({ basis: v })} />
        </div>
        <span className="hidden w-px self-stretch md:block" style={{ background: COLORS.line }} />
        <div className="flex flex-wrap gap-1.5">
          {quickRanges().map((r) => {
            const on = f.from === r.from && f.to === r.to;
            return (
              <button key={r.key} type="button" onClick={() => set({ from: r.from, to: r.to })}
                className="rounded-full border px-3 py-0.5 text-[13.5px]"
                style={on ? { borderColor: COLORS.green, color: COLORS.green, background: COLORS.greenWash } : { borderColor: COLORS.line, color: COLORS.ink2 }}>
                {r.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="text-[13px]" style={{ color: COLORS.muted }} htmlFor="rf-from">From</label>
          <input id="rf-from" type="date" className={ctl} style={{ borderColor: COLORS.line }} value={f.from} onChange={(e) => set({ from: e.target.value })} />
          <label className="text-[13px]" style={{ color: COLORS.muted }} htmlFor="rf-to">to</label>
          <input id="rf-to" type="date" className={ctl} style={{ borderColor: COLORS.line }} value={f.to} onChange={(e) => set({ to: e.target.value })} />
          <span className="text-[13px]" style={{ color: COLORS.muted }}>{dmy(f.from)} to {dmy(f.to)}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
        {select("channel", "All channels", (options?.channels ?? []).map((c) => [c, c]))}
        {showAgent && select("agent", "All agents", (options?.agents ?? []).map((a) => [String(a.id ?? "none"), a.name]))}
        {select("courier", "All couriers", [...(options?.couriers ?? []).map((c): [string, string] => [c, courierLabel(c)]), ["none", "No courier set"]])}
        {select("district", "All districts", (options?.districts ?? []).map((d) => [d, d]))}
        {select("status", "All statuses", STATUSES.map((s) => [s, s]))}
        <button type="button" onClick={reset} className="text-sm" style={{ color: COLORS.green }}>Clear filters</button>
      </div>
    </section>
  );
}
