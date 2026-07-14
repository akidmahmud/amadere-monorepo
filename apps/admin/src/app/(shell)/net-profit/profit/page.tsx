"use client";

import { useState } from "react";
import { Button, Card, Tabs } from "@amader/admin-ui";
import { useProductCosts, useProfitOrders, useProfitReport, useRecomputeProfit, useSetProductCost } from "@/hooks/useProfit";
import { useDailyProfitCache, useMarketingCosts, useSetMarketingCost } from "@/hooks/useMarketingCost";

function ReportTab() {
  const { data: report } = useProfitReport();
  const { data, isLoading } = useProfitOrders();
  const recompute = useRecomputeProfit();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="flex flex-col items-center gap-1 py-4">
          <span className="text-2xl font-semibold text-text">৳{Number(report?.revenue ?? 0).toLocaleString()}</span>
          <span className="text-xs text-muted">Revenue</span>
        </Card>
        <Card className="flex flex-col items-center gap-1 py-4">
          <span className="text-2xl font-semibold text-secondary">৳{Number(report?.cogs ?? 0).toLocaleString()}</span>
          <span className="text-xs text-muted">COGS</span>
        </Card>
        <Card className="flex flex-col items-center gap-1 py-4">
          <span className="text-2xl font-semibold text-success">৳{Number(report?.netProfit ?? 0).toLocaleString()}</span>
          <span className="text-xs text-muted">Net profit ({report?.orderCount ?? 0} orders)</span>
        </Card>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {data && data.items.length === 0 && <p className="text-sm text-muted">No profit computed yet — completes automatically when an order reaches COMPLETED.</p>}

      <div className="flex flex-col gap-2">
        {data?.items.map((p) => (
          <Card key={p.id} className="flex items-center gap-3">
            <span className="num text-sm text-text">Order #{p.orderId}</span>
            <span className="text-xs text-secondary">Rev ৳{Number(p.revenue).toLocaleString()}</span>
            <span className="text-xs text-secondary">COGS ৳{Number(p.cogs).toLocaleString()}</span>
            <span className="text-xs text-secondary">Ship ৳{Number(p.shipping).toLocaleString()}</span>
            <span className="text-xs text-secondary">Ads ৳{Number(p.adSpend).toLocaleString()}</span>
            <span className="ml-auto text-sm font-semibold text-success">Net ৳{Number(p.netProfit).toLocaleString()}</span>
            <Button type="button" variant="ghost" disabled={recompute.isPending} onClick={() => recompute.mutate(p.orderId)}>
              Recompute
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ProductCostTab() {
  const { data, isLoading } = useProductCosts();
  const setCost = useSetProductCost();
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  return (
    <div className="flex flex-col gap-2">
      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {data?.items.map((p) => (
        <Card key={p.id} className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-sm text-text">{p.name}</span>
          <span className="text-xs text-muted">Sell ৳{p.price ?? "—"}</span>
          <input
            type="number"
            min={0}
            placeholder="Buy price"
            value={drafts[p.id] ?? p.costPerItem ?? ""}
            onChange={(e) => setDrafts({ ...drafts, [p.id]: e.target.value })}
            className="h-9 w-28 rounded-sm border border-border bg-surface px-2 text-sm text-text outline-none focus:border-brand-500"
          />
          <Button
            type="button"
            variant="ghost"
            disabled={setCost.isPending || !drafts[p.id]}
            onClick={() => setCost.mutate({ productId: p.id, buyPrice: Number(drafts[p.id]) })}
          >
            Save
          </Button>
        </Card>
      ))}
    </div>
  );
}

function DailyProfitTab() {
  const { data: costs } = useMarketingCosts();
  const { data: cache, isLoading } = useDailyProfitCache();
  const setCost = useSetMarketingCost();

  const today = new Date().toISOString().slice(0, 10);
  const todayCost = costs?.find((c) => c.costDate === today);
  const [adsCost, setAdsCost] = useState(todayCost?.adsCost ?? "");
  const [otherCost, setOtherCost] = useState(todayCost?.otherCost ?? "");

  const byDate = new Map(cache?.map((c) => [c.reportDate, c]));

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-secondary">Today's marketing cost ({today})</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Ads cost (৳)</span>
            <input type="number" min={0} value={adsCost} onChange={(e) => setAdsCost(e.target.value)} className="h-10 w-32 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Other cost (৳)</span>
            <input type="number" min={0} value={otherCost} onChange={(e) => setOtherCost(e.target.value)} className="h-10 w-32 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
          </label>
          <Button
            type="button"
            variant="primary"
            disabled={setCost.isPending || adsCost === "" || otherCost === ""}
            onClick={() => setCost.mutate({ date: today, adsCost: Number(adsCost), otherCost: Number(otherCost) })}
          >
            {setCost.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
        {todayCost?.autoCarried && <p className="text-xs text-warning">Auto-carried forward from the previous day.</p>}
      </Card>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      <div className="flex flex-col gap-2">
        {[...byDate.entries()].reverse().map(([date, day]) => (
          <Card key={date} className="flex items-center gap-3">
            <span className="num text-sm text-text">{date}</span>
            <span className="text-xs text-secondary">Rev ৳{Number(day.totalRevenue).toLocaleString()}</span>
            <span className="text-xs text-secondary">Buy ৳{Number(day.totalBuyCost).toLocaleString()}</span>
            <span className="text-xs text-secondary">Ads ৳{Number(day.totalAdsCost).toLocaleString()}</span>
            <span className="text-xs text-secondary">Other ৳{Number(day.totalOther).toLocaleString()}</span>
            <span className="text-xs text-secondary">Ship ৳{Number(day.totalShipping).toLocaleString()}</span>
            <span className={`ml-auto text-sm font-semibold ${Number(day.netProfit) >= 0 ? "text-success" : "text-danger"}`}>
              Net ৳{Number(day.netProfit).toLocaleString()}
            </span>
          </Card>
        ))}
        {cache && cache.length === 0 && <p className="text-sm text-muted">No daily profit computed yet — rebuilt nightly, or set today's marketing cost above to trigger a recompute.</p>}
      </div>
    </div>
  );
}

export default function ProfitPage() {
  const [tab, setTab] = useState("report");

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        options={[
          { value: "report", label: "Profit Report" },
          { value: "cost", label: "Product Cost" },
          { value: "daily", label: "Daily Profit" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "report" && <ReportTab />}
      {tab === "cost" && <ProductCostTab />}
      {tab === "daily" && <DailyProfitTab />}
    </div>
  );
}
