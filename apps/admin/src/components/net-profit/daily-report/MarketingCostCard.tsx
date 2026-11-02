"use client";

import { useState } from "react";
import { Button, Card } from "@amader/admin-ui";
import { useMarketingCosts, useSetMarketingCost } from "@/hooks/useMarketingCost";
import { inputClass } from "./format";

/** Local (Dhaka) date, not UTC: before 6 AM toISOString() is still yesterday. */
const today = () => new Date().toLocaleDateString("en-CA");

/**
 * One day's marketing spend. Each date keeps its own amount, so changing
 * today never moves a past day's report. Read by the "From Marketing Cost
 * entries" fixed-cost type.
 */
export function MarketingCostCard({ linked }: { linked: boolean }) {
  const { data: costs } = useMarketingCosts();
  const save = useSetMarketingCost();
  const [date, setDate] = useState(today);
  const [ads, setAds] = useState("");
  const [other, setOther] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const saved = costs?.find((c) => c.costDate.slice(0, 10) === date);

  function onSave() {
    setMsg(null);
    save.mutate(
      {
        date,
        adsCost: Number(ads || saved?.adsCost || 0),
        otherCost: Number(other || saved?.otherCost || 0),
      },
      {
        onSuccess: () => {
          setAds("");
          setOther("");
          setMsg(`Saved for ${date}`);
        },
        onError: (e) => setMsg((e as Error).message),
      },
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <h3 className="font-bold">Daily marketing cost</h3>
      <p className="text-xs text-muted">
        Enter each day&apos;s ad spend (৳). Every date keeps its own amount, so
        changing today never changes an earlier day&apos;s report. A day left
        empty copies the day before.
      </p>
      {!linked && (
        <p className="text-xs font-semibold text-amber-600">
          Not used yet: set your Marketing fixed cost to “From Marketing Cost
          entries” above and save settings.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Date
          <input
            type="date"
            className={inputClass}
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value || today())}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Ads cost (৳)
          <input
            type="number"
            min="0"
            className={inputClass}
            placeholder={saved?.adsCost ?? "0"}
            value={ads}
            onChange={(e) => setAds(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Other cost (৳)
          <input
            type="number"
            min="0"
            className={inputClass}
            placeholder={saved?.otherCost ?? "0"}
            value={other}
            onChange={(e) => setOther(e.target.value)}
          />
        </label>
        <Button
          onClick={onSave}
          disabled={save.isPending || (ads === "" && other === "")}
        >
          {save.isPending ? "Saving…" : "Save cost"}
        </Button>
      </div>
      <p className="text-xs text-muted">
        {saved
          ? `Saved for ${date}: ৳${Number(saved.adsCost) + Number(saved.otherCost)}${saved.autoCarried ? " (copied from the day before)" : ""}`
          : `Nothing saved for ${date} yet.`}
        {msg && <span className="ml-2 font-semibold text-brand-500">{msg}</span>}
      </p>
    </Card>
  );
}
