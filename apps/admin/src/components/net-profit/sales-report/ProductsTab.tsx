"use client";
import { useEffect } from "react";
import { useReportProducts } from "@/hooks/useSalesReportV2";
import { COLORS, pc, tk } from "./format";
import type { TabProps } from "./ReportFilters";
import { ReportTable } from "./Table";
import { Tag } from "./Tags";

export function ProductsTab({ f, onExport }: TabProps) {
  const { data } = useReportProducts(f);
  const rows = data?.rows ?? [];
  const tot = rows.reduce(
    (t, r) => ({
      units: t.units + r.units,
      net: t.net + r.net,
      cogs: t.cogs + r.cogs,
      subsidy: t.subsidy + r.subsidy,
      other: t.other + r.other,
      ret: t.ret + r.ret,
      contrib: t.contrib + r.contrib,
    }),
    { units: 0, net: 0, cogs: 0, subsidy: 0, other: 0, ret: 0, contrib: 0 },
  );
  useEffect(() => {
    onExport(
      "products",
      data
        ? [
            [
              "Product SKU",
              "Units",
              "Net sales",
              "Product cost",
              "Delivery subsidy",
              "Packaging and fees",
              "Return losses",
              "Contribution",
              "Margin",
              "Cost status",
            ],
            ...rows.map((r) => [
              r.sku || r.name,
              r.units,
              Math.round(r.net),
              Math.round(r.cogs),
              Math.round(r.subsidy),
              Math.round(r.other),
              Math.round(r.ret),
              Math.round(r.contrib),
              pc(r.net ? r.contrib / r.net : 0),
              r.costStatus,
            ]),
          ]
        : null,
    );
  }, [data, rows, onExport]);
  const costTag = (s: string) =>
    s === "missing" ? (
      <Tag tone="loss">Missing</Tag>
    ) : s === "unconfirmed" ? (
      <Tag tone="info">Unconfirmed</Tag>
    ) : (
      <Tag>Confirmed</Tag>
    );
  return (
    <div>
      <p className="mb-2.5 text-[13px]" style={{ color: COLORS.muted }}>
        Delivery subsidy and return losses are shared across items in an order
        by weight. Packaging and payment fees by value. Each order&apos;s parts
        add back to its contribution.
      </p>
      <ReportTable
        cols={[
          { h: "Product" },
          { h: "Units", num: true },
          { h: "Net sales", num: true },
          { h: "Product cost", num: true },
          { h: "Delivery subsidy", num: true },
          { h: "Packaging and fees", num: true },
          { h: "Return losses", num: true },
          { h: "Contribution", num: true },
          { h: "Margin", num: true },
          { h: "Cost" },
        ]}
        rows={rows.map((r) => [
          r.name,
          r.units,
          tk(r.net),
          tk(-r.cogs),
          tk(-r.subsidy),
          tk(-r.other),
          tk(-r.ret),
          <span
            key="c"
            style={{ color: r.contrib < 0 ? COLORS.loss : undefined }}
          >
            {tk(r.contrib)}
          </span>,
          r.net ? pc(r.contrib / r.net) : "-",
          costTag(r.costStatus),
        ])}
        foot={[
          "Total",
          tot.units,
          tk(tot.net),
          tk(-tot.cogs),
          tk(-tot.subsidy),
          tk(-tot.other),
          tk(-tot.ret),
          tk(tot.contrib),
          pc(tot.net ? tot.contrib / tot.net : 0),
          "",
        ]}
      />
    </div>
  );
}
