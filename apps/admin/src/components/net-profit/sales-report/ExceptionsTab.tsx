"use client";
import { useEffect } from "react";
import {
  useReportExceptions,
  type FlagKey,
  type OrderRow,
} from "@/hooks/useSalesReportV2";
import { COLORS, FLAG, agentLabel, courierLabel, dmy, tk } from "./format";
import type { TabProps } from "./ReportFilters";
import { ReportTable, Small } from "./Table";
import { StatusBadge } from "./Tags";

function detail(f: FlagKey, c: OrderRow, money: boolean): string {
  switch (f) {
    case "loss":
    case "low":
      return `${c.lines.map((l) => `${l.name} × ${l.qty}`).join(", ")}${money ? `; delivery paid ${tk(c.o.delivery ?? 0)}, courier ${tk(c.courierCharge)}` : ""}`;
    case "over":
      return `Agreed ${(c.expected ?? 0).toFixed(2)} for ${c.weight} kg, billed ${tk(c.o.actual ?? 0)}`;
    case "stuck":
      return `${c.o.status} since ${dmy(c.o.date)}`;
    case "nobill":
      return `Delivered ${dmy(c.o.hist.delivered)}, using estimate ${tk(c.expected)}`;
    case "unconf":
      return c.lines
        .filter((l) => l.costOk === false && l.unitCost != null)
        .map((l) => `${l.name} at ${tk(l.unitCost)}`)
        .join(", ");
    case "nocost":
      return c.lines
        .filter((l) => l.unitCost == null)
        .map((l) => l.name)
        .join(", ");
    case "nocourier":
      return money
        ? `Billed ${tk(c.o.actual ?? 0)} with no courier to check against`
        : "Courier not set on a shipped order";
  }
}

function amount(f: FlagKey, c: OrderRow, money: boolean): string {
  if (!money) return "-";
  if (f === "loss" || f === "low") return tk(c.contribution);
  if (f === "over") return `+${(c.overcharge ?? 0).toFixed(2)}`;
  if (f === "stuck") return tk(c.netSales);
  if (f === "nobill") return tk(c.expected);
  return "-";
}

export function ExceptionsTab({ f, setFilters, money, onExport }: TabProps) {
  const { data } = useReportExceptions(f);
  const groups = data?.groups ?? [];
  useEffect(() => {
    onExport(
      "exceptions",
      data
        ? [
            [
              "Issue",
              "Order ID",
              "Order date",
              "Status",
              "Agent",
              "Courier",
              "Amount",
              "Action",
            ],
            ...groups.flatMap((g) =>
              g.rows.map((c) => [
                FLAG[g.flag].label,
                c.o.orderNumber,
                dmy(c.o.date),
                c.o.status,
                agentLabel(c.o.agentName),
                c.o.courier ?? "",
                amount(g.flag, c, money),
                FLAG[g.flag].action,
              ]),
            ),
          ]
        : null,
    );
  }, [data, groups, money, onExport]);

  // Jump to the order in Orders: widen the date range to include it, search for it, open it.
  const goto = (c: OrderRow) =>
    setFilters({
      tab: "orders",
      basis: "order",
      from: c.o.date < f.from ? c.o.date : f.from,
      to: c.o.date > f.to ? c.o.date : f.to,
      q: c.o.orderNumber,
      open: String(c.o.id),
    });

  if (!groups.length) {
    return (
      <div
        className="rounded-xl border bg-white p-7 text-center"
        style={{ borderColor: COLORS.line, color: COLORS.ink2 }}
      >
        Nothing needs attention. Every order has a courier, a confirmed cost and
        a bill within tolerance.
      </div>
    );
  }
  return (
    <div>
      <p className="mb-3 text-[13px]" style={{ color: COLORS.muted }}>
        Exceptions ignore the date range so nothing old is missed. Other filters
        still apply. Thresholds are set in Rates and costs.
      </p>
      {groups.map((g) => (
        <div key={g.flag} className="mb-3.5">
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2.5">
            <h3 className="text-base font-semibold">
              {FLAG[g.flag].label}{" "}
              <span
                className="text-[13px] font-normal"
                style={{ color: COLORS.muted }}
              >
                {g.rows.length}
              </span>
            </h3>
            <span className="text-[13.5px]" style={{ color: COLORS.ink2 }}>
              {FLAG[g.flag].action}
            </span>
          </div>
          <ReportTable
            cols={[
              { h: "Order" },
              { h: "Status" },
              { h: "Agent" },
              { h: "Courier" },
              { h: "Detail" },
              { h: "Amount", num: true },
            ]}
            rows={g.rows.map((c) => [
              <span key="o">
                <button
                  type="button"
                  className="text-sm"
                  style={{ color: COLORS.green }}
                  onClick={() => goto(c)}
                >
                  {c.o.orderNumber}
                </button>
                <Small>{dmy(c.o.date)}</Small>
              </span>,
              <StatusBadge key="s" status={c.o.status} />,
              agentLabel(c.o.agentName),
              c.o.courier ? (
                courierLabel(c.o.courier)
              ) : (
                <span key="c" style={{ color: COLORS.loss }}>
                  not set
                </span>
              ),
              detail(g.flag, c, money),
              amount(g.flag, c, money),
            ])}
          />
        </div>
      ))}
    </div>
  );
}
