"use client";

import { useState } from "react";
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

const TYPE_LABEL: Record<FixedCostType, string> = {
  PER_DAY: "৳ per day",
  PER_MONTH: "৳ per month (split by day)",
  PERCENT_OF_SALES: "% of sales",
  MARKETING_LEDGER: "From Marketing Cost entries",
};

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
          label="Create the previous day's report every night after 12 AM"
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
          “Whole report” costs appear under the grand total, and a cost for one
          source is taken off that source&apos;s total.
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
            <select
              className={inputClass}
              aria-label="Applies to"
              value={
                c.scope === "REPORT" ? "REPORT" : `SOURCE:${c.sourceKey ?? ""}`
              }
              onChange={(e) => {
                const v = e.target.value;
                setCost(
                  i,
                  v === "REPORT"
                    ? { scope: "REPORT", sourceKey: undefined }
                    : { scope: "SOURCE", sourceKey: v.slice(7) },
                );
              }}
            >
              <option value="REPORT">Whole report</option>
              {d.sources.map((s) => (
                <option key={s.key} value={`SOURCE:${s.key}`}>
                  {s.label} only
                </option>
              ))}
            </select>
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
