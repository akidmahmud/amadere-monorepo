"use client";

import { useEffect, useRef, useState } from "react";
import type {
  DailyReportFixedCost,
  DailyReportSettingsView,
  FixedCostType,
} from "@amader/shared";
import { Button, Card, ToggleSwitch } from "@amader/admin-ui";
import {
  useDailyReportSettings,
  useSaveDailyReportSettings,
} from "@/hooks/useDailyReports";
import { inputClass } from "./format";
import { MarketingCostCard } from "./MarketingCostCard";

const TYPE_LABEL: Record<FixedCostType, string> = {
  PER_DAY: "৳ per day",
  PER_MONTH: "৳ per month (split by day)",
  PERCENT_OF_SALES: "% of sales",
  MARKETING_LEDGER: "From Marketing Cost entries",
};

/** "Applies to" with tick boxes: nothing ticked = the whole report. */
function AppliesTo({
  sources,
  value,
  onChange,
}: {
  sources: { key: string; label: string }[];
  value: string[];
  onChange: (keys: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const picked = sources.filter((s) => value.includes(s.key));
  const text =
    picked.length === 0
      ? "Whole report"
      : picked.length === 1
        ? `${picked[0].label} only`
        : `${picked[0].label} +${picked.length - 1}`;
  const toggle = (key: string, on: boolean) =>
    onChange(on ? [...value, key] : value.filter((k) => k !== key));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Applies to"
        className={`${inputClass} min-w-56 max-w-72 truncate text-left`}
        onClick={() => setOpen((o) => !o)}
      >
        {text}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-80 min-w-64 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg">
          <div className="flex items-center justify-between px-3 py-1.5 text-xs">
            <span className="text-muted">
              {picked.length ? `${picked.length} selected` : "Whole report"}
            </span>
            {picked.length > 0 && (
              <button
                type="button"
                className="font-semibold text-danger"
                onClick={() => onChange([])}
              >
                Clear
              </button>
            )}
          </div>
          {sources.map((s) => (
            <label
              key={s.key}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-2"
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-500"
                checked={value.includes(s.key)}
                onChange={(e) => toggle(s.key, e.target.checked)}
              />
              {s.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function SettingsPanel() {
  const q = useDailyReportSettings(true);
  const save = useSaveDailyReportSettings();
  // Local edits only; until the first edit the server copy is shown as-is.
  const [draft, setD] = useState<DailyReportSettingsView | null>(null);
  const d = draft ?? q.data ?? null;
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (q.error)
    return <Card className="text-danger">{(q.error as Error).message}</Card>;
  if (!d) return <Card>Loading…</Card>;

  const setCost = (i: number, patch: Partial<DailyReportFixedCost>) =>
    setD({
      ...d,
      fixedCosts: d.fixedCosts.map((c, j) =>
        j === i ? { ...c, ...patch } : c,
      ),
    });
  const move = (i: number, by: -1 | 1) => {
    const s = [...d.sources];
    const j = i + by;
    if (j < 0 || j >= s.length) return;
    [s[i], s[j]] = [s[j], s[i]];
    setD({ ...d, sources: s });
  };

  async function onSave() {
    setMsg(null);
    try {
      const saved = await save.mutateAsync({
        autoEnabled: d!.autoEnabled,
        sources: d!.sources.map(({ key, enabled }) => ({ key, enabled })),
        fixedCosts: d!.fixedCosts,
      });
      setD(saved);
      setMsg({
        ok: true,
        text: "Saved. New reports use these settings; saved reports do not change.",
      });
    } catch (e) {
      setMsg({
        ok: false,
        text: e instanceof Error ? e.message : "Could not save.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2">
        <h3 className="font-bold">Automatic report</h3>
        <ToggleSwitch
          checked={d.autoEnabled}
          onChange={(v) => setD({ ...d, autoEnabled: v })}
          label="Create each day's report automatically at 8 PM (day = 8 PM to 8 PM)"
        />
      </Card>

      <Card className="flex flex-col gap-2">
        <h3 className="font-bold">Sources</h3>
        <p className="text-xs text-muted">
          Turned-off sources are left out of new reports. The order here is the
          order in the report.
        </p>
        <ul className="flex flex-col divide-y divide-border">
          {d.sources.map((s, i) => (
            <li key={s.key} className="flex items-center gap-3 py-2">
              <ToggleSwitch
                checked={s.enabled}
                onChange={(v) =>
                  setD({
                    ...d,
                    sources: d.sources.map((x, j) =>
                      j === i ? { ...x, enabled: v } : x,
                    ),
                  })
                }
                label={s.label}
                className="flex-1"
              />
              <Button
                variant="ghost"
                className="h-8 px-2"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label={`Move ${s.label} up`}
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                className="h-8 px-2"
                disabled={i === d.sources.length - 1}
                onClick={() => move(i, 1)}
                aria-label={`Move ${s.label} down`}
              >
                ↓
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex flex-col gap-3">
        <h3 className="font-bold">Fixed costs</h3>
        <p className="text-xs text-muted">
          Costs taken off net profit, e.g. Marketing, VAT, rent, salaries.
          “Whole report” costs appear under the grand total. Tick one or more
          sources to take a cost off those sources instead; a fixed amount on
          several sources is shared between them by their sales.
        </p>
        {d.fixedCosts.map((c, i) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center gap-2 border-b border-border pb-3"
          >
            <input
              className={`${inputClass} w-48`}
              placeholder="Name"
              value={c.name}
              maxLength={60}
              onChange={(e) => setCost(i, { name: e.target.value })}
              aria-label="Cost name"
            />
            <select
              className={inputClass}
              value={c.type}
              aria-label="Cost type"
              onChange={(e) =>
                setCost(i, { type: e.target.value as FixedCostType })
              }
            >
              {Object.entries(TYPE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            {c.type !== "MARKETING_LEDGER" && (
              <input
                type="number"
                min={0}
                max={c.type === "PERCENT_OF_SALES" ? 100 : undefined}
                step="0.01"
                className={`${inputClass} w-32`}
                value={c.amount}
                aria-label="Amount"
                onChange={(e) =>
                  setCost(i, {
                    amount: e.target.value === "" ? 0 : Number(e.target.value),
                  })
                }
              />
            )}
            <AppliesTo
              sources={d.sources}
              value={
                c.scope === "REPORT"
                  ? []
                  : (c.sourceKeys ?? (c.sourceKey ? [c.sourceKey] : []))
              }
              onChange={(keys) =>
                setCost(
                  i,
                  keys.length
                    ? { scope: "SOURCE", sourceKeys: keys, sourceKey: undefined }
                    : { scope: "REPORT", sourceKeys: undefined, sourceKey: undefined },
                )
              }
            />
            <ToggleSwitch
              checked={c.active}
              onChange={(v) => setCost(i, { active: v })}
              label="Active"
            />
            <Button
              variant="link"
              className="text-danger"
              onClick={() =>
                setD({
                  ...d,
                  fixedCosts: d.fixedCosts.filter((_, j) => j !== i),
                })
              }
            >
              Remove
            </Button>
          </div>
        ))}
        <div>
          <Button
            variant="ghost"
            onClick={() =>
              setD({
                ...d,
                fixedCosts: [
                  ...d.fixedCosts,
                  {
                    id: crypto.randomUUID(),
                    name: "",
                    type: "PER_DAY",
                    amount: 0,
                    scope: "REPORT",
                    active: true,
                  },
                ],
              })
            }
          >
            + Add fixed cost
          </Button>
        </div>
      </Card>

      <MarketingCostCard
        linked={d.fixedCosts.some((c) => c.active && c.type === "MARKETING_LEDGER")}
      />

      <div className="flex items-center gap-3">
        <Button onClick={onSave} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save settings"}
        </Button>
        {msg && (
          <span
            className={`text-sm ${msg.ok ? "text-brand-500" : "text-danger"}`}
          >
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
