"use client";
import { useEffect, useState } from "react";
import { useReportAgents } from "@/hooks/useSalesReportV2";
import { COLORS, agentLabel, pc, tk } from "./format";
import { Seg, type TabProps } from "./ReportFilters";
import { ReportTable } from "./Table";

export function AgentsTab({ f, onExport }: TabProps) {
  const { data } = useReportAgents(f);
  const [rankBy, setRankBy] = useState<"contribution" | "sales">("contribution");
  const rows = [...(data?.rows ?? [])].sort((a, b) => (rankBy === "sales" ? a.rankSales - b.rankSales : a.rankContrib - b.rankContrib));
  useEffect(() => {
    onExport("agents", data ? [
      ["Agent", "Booked", "Delivered", "Cancelled or returned", "Net sales", "Contribution", "Margin", "Average order", "New", "Repeat", "Rank by sales", "Rank by contribution"],
      ...rows.map((r) => [agentLabel(r.agentName), r.s.n, r.s.dN, pc(r.s.lossRate), Math.round(r.s.net ?? 0), Math.round(r.s.contrib ?? 0), pc(r.s.margin ?? 0), Math.round(r.s.aov ?? 0), r.s.newN, r.s.repN, r.rankSales, r.rankContrib]),
    ] : null);
  }, [data, rows, onExport]);
  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
        <span className="text-[13px]" style={{ color: COLORS.muted }}>Rank by</span>
        <Seg value={rankBy} options={[["contribution", "Contribution"], ["sales", "Net sales"]]} onChange={setRankBy} />
        <span className="text-[13px]" style={{ color: COLORS.muted }}>The rank columns show where each agent sits on both measures.</span>
      </div>
      <ReportTable
        cols={[{ h: "Agent" }, { h: "Booked", num: true }, { h: "Delivered", num: true }, { h: "Cancelled or returned", num: true }, { h: "Net sales", num: true }, { h: "Contribution", num: true }, { h: "Margin", num: true }, { h: "Average order", num: true }, { h: "New / repeat", num: true }, { h: "Rank: sales", num: true }, { h: "Rank: contribution", num: true }]}
        rows={rows.map((r) => [
          agentLabel(r.agentName), r.s.n, r.s.dN, pc(r.s.lossRate), tk(r.s.net ?? 0),
          <span key="c" style={{ color: (r.s.contrib ?? 0) < 0 ? COLORS.loss : undefined }}>{tk(r.s.contrib ?? 0)}</span>,
          r.s.net ? pc(r.s.margin ?? 0) : "-", tk(r.s.aov ?? 0), `${r.s.newN} / ${r.s.repN}`, r.rankSales,
          <span key="r">{r.rankContrib}{r.rankContrib !== r.rankSales && <span className="ml-1 text-[13px]" style={{ color: r.rankContrib < r.rankSales ? COLORS.gain : COLORS.loss }}>{r.rankContrib < r.rankSales ? "up" : "down"} {Math.abs(r.rankContrib - r.rankSales)}</span>}</span>,
        ])}
      />
    </div>
  );
}
