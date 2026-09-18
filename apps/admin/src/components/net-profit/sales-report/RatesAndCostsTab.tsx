"use client";
import { useEffect, useState } from "react";
import { useReportSettings, useSaveReportSettings, type ReportSettings } from "@/hooks/useSalesReportV2";
import { COLORS } from "./format";
import { Panel } from "./OverviewTab";
import type { TabProps } from "./ReportFilters";
import { RateCardEditor } from "./RateCardEditor";
import { OtherCostsCard } from "./OtherCostsCard";
import { CostHistoryEditor } from "./CostHistoryEditor";
import { CourierBillImport } from "./CourierBillImport";
import { LegacySettings } from "./LegacySettings";

export function RatesAndCostsTab({ onExport }: TabProps) {
  const { data } = useReportSettings();
  const save = useSaveReportSettings();
  const [draft, setDraft] = useState<ReportSettings | null>(null);
  useEffect(() => { onExport("rates-and-costs", null); }, [onExport]);
  useEffect(() => { if (data) setDraft(data.settings); }, [data]);
  if (!data || !draft) return <div className="p-7 text-center" style={{ color: COLORS.ink2 }}>Loading…</div>;
  const ro = !data.canEdit;
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.settings);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5">
      {ro && <div className="rounded-lg px-3 py-2 text-[13.5px]" style={{ background: COLORS.amberWash, color: COLORS.amber }}>Managers can view rates and costs. Only admins can change them.</div>}
      {!ro && (dirty || save.isError) && (
        <div className="sticky top-2 z-10 flex items-center gap-3 rounded-lg border bg-white px-3 py-2 shadow-sm" style={{ borderColor: COLORS.line }}>
          <span className="text-sm">Unsaved changes to rates, fees or thresholds.</span>
          {save.isError && <span className="text-sm" style={{ color: COLORS.loss }}>{(save.error as Error).message}</span>}
          <span className="flex-1" />
          <button type="button" onClick={() => setDraft(data.settings)} className="text-sm" style={{ color: COLORS.muted }}>Discard</button>
          <button type="button" disabled={save.isPending} onClick={() => save.mutate(draft)} className="rounded-lg px-3.5 py-1 text-sm font-semibold text-white disabled:opacity-40" style={{ background: COLORS.green }}>{save.isPending ? "Saving…" : "Save"}</button>
        </div>
      )}
      <Panel title="Courier rate card" hint="Agreed charge = rate for the parcel weight + COD charge. Zones are your Shipping Zones. Change a value and save to see every report update.">
        <RateCardEditor s={draft} couriers={data.couriers} zones={data.zones} disabled={ro} onChange={setDraft} />
      </Panel>
      <Panel title="Product costs" hint="Each order uses the cost active on its order date, so adding a new cost never changes past reports.">
        <CostHistoryEditor canEdit={!ro} />
      </Panel>
      <Panel title="Other costs and alerts" hint="Payment fees apply to advance amounts. Enter your merchant rates.">
        <OtherCostsCard s={draft} disabled={ro} onChange={setDraft} />
      </Panel>
      {!ro && (
        <Panel title="Courier bills" hint="Upload the courier's per-parcel statement CSV. Parcels are matched by consignment ID; the billed charge replaces the rate-card estimate.">
          <CourierBillImport couriers={data.couriers} />
        </Panel>
      )}
      <LegacySettings />
    </div>
  );
}
