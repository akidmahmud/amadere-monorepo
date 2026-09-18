"use client";
import { useEffect } from "react";
import { useReportCouriers } from "@/hooks/useSalesReportV2";
import { COLORS, courierLabel, tk } from "./format";
import { Panel } from "./OverviewTab";
import type { TabProps } from "./ReportFilters";
import { ReportTable, Small } from "./Table";

export function CouriersTab({ f, onExport }: TabProps) {
  const { data } = useReportCouriers(f);
  const rows = data?.rows ?? [];
  useEffect(() => {
    onExport(
      "couriers",
      data
        ? [
            [
              "Courier",
              "Parcels",
              "Returned",
              "Agreed charge",
              "Billed",
              "Overcharged",
              "Undercharged",
              "Orders over tolerance",
              "Awaiting bill",
              "COD collected",
              "Net receivable",
            ],
            ...rows.map((r) => [
              r.courier ? courierLabel(r.courier) : "No courier set",
              r.n,
              r.ret,
              r.agreed,
              r.billed,
              r.over,
              r.under,
              r.overN,
              r.awaiting,
              r.collect,
              r.recv,
            ]),
          ]
        : null,
    );
  }, [data, rows, onExport]);
  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-[13px]" style={{ color: COLORS.muted }}>
        Delivered and returned parcels in this period. Agreed charge comes from
        the rate card in Rates and costs. Billed is what the courier deducted in
        its settlement.
      </p>
      <ReportTable
        cols={[
          { h: "Courier" },
          { h: "Parcels", num: true },
          { h: "Returned", num: true },
          { h: "Agreed charge", num: true },
          { h: "Billed", num: true },
          { h: "Overcharged", num: true },
          { h: "Undercharged", num: true },
          { h: "Awaiting bill", num: true },
          { h: "COD collected", num: true },
          { h: "Net receivable", num: true },
        ]}
        rows={rows.map((r) => [
          r.courier ? (
            courierLabel(r.courier)
          ) : (
            <span key="n" style={{ color: COLORS.loss }}>
              No courier set
            </span>
          ),
          r.n,
          r.ret,
          r.courier ? tk(r.agreed) : "-",
          tk(r.billed),
          <span key="o" style={{ color: r.over > 0 ? COLORS.loss : undefined }}>
            {tk(r.over)}
            <Small>{r.overN} over tolerance</Small>
          </span>,
          tk(r.under),
          <span key="a">
            {r.awaiting}
            {r.awaiting > 0 && <Small>est. {tk(r.awaitingAmt)}</Small>}
          </span>,
          tk(r.collect),
          tk(r.recv),
        ])}
      />
      <Panel
        title="Largest overcharges"
        hint="Claim these back in the next settlement"
      >
        <ReportTable
          empty="No overcharges above tolerance in this period."
          cols={[
            { h: "Order" },
            { h: "Courier" },
            { h: "District" },
            { h: "Weight", num: true },
            { h: "Agreed", num: true },
            { h: "Billed", num: true },
            { h: "Difference", num: true },
          ]}
          rows={(data?.top ?? []).map((c) => [
            c.o.orderNumber,
            courierLabel(c.o.courier),
            c.o.district,
            `${c.weight} kg`,
            (c.expected ?? 0).toFixed(2),
            tk(c.o.actual ?? 0),
            <span key="d" style={{ color: COLORS.loss }}>
              +{(c.overcharge ?? 0).toFixed(2)}
            </span>,
          ])}
        />
      </Panel>
    </div>
  );
}
