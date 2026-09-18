"use client";
import { useEffect } from "react";
import { useReportDistricts, type Summary } from "@/hooks/useSalesReportV2";
import { pc, tk } from "./format";
import type { TabProps } from "./ReportFilters";
import { ReportTable } from "./Table";

const per = (s: Summary, v: number | undefined) => (s.dN ? (v ?? 0) / s.dN : 0);

export function DistrictsTab({ f, onExport }: TabProps) {
  const { data } = useReportDistricts(f);
  const rows = data?.rows ?? [];
  useEffect(() => {
    onExport("districts", data ? [
      ["District", "Zone", "Booked", "Delivered", "Net sales", "Delivery paid per order", "Courier charge per order", "Subsidy per order", "Cancelled or returned", "Contribution per order"],
      ...rows.map((r) => [r.district, r.zone, r.s.n, r.s.dN, Math.round(r.s.net ?? 0), Math.round(per(r.s, r.s.deliveryPaid)), Math.round(per(r.s, r.s.courierCost)), Math.round(per(r.s, r.s.subsidy)), pc(r.s.lossRate), Math.round(per(r.s, r.s.contrib))]),
    ] : null);
  }, [data, rows, onExport]);
  return (
    <ReportTable
      cols={[{ h: "District" }, { h: "Zone" }, { h: "Booked", num: true }, { h: "Delivered", num: true }, { h: "Net sales", num: true }, { h: "Delivery paid per order", num: true }, { h: "Courier charge per order", num: true }, { h: "Subsidy per order", num: true }, { h: "Cancelled or returned", num: true }, { h: "Contribution per order", num: true }]}
      rows={rows.map((r) => [r.district || "-", r.zone, r.s.n, r.s.dN, tk(r.s.net ?? 0), tk(per(r.s, r.s.deliveryPaid)), tk(per(r.s, r.s.courierCost)), tk(per(r.s, r.s.subsidy)), pc(r.s.lossRate), tk(per(r.s, r.s.contrib))])}
    />
  );
}
