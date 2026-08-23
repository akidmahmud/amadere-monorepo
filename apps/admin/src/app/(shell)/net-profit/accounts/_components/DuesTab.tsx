"use client";

import { useState } from "react";
import { Tabs } from "@amader/admin-ui";
import { useAgeing, type DateRange } from "@/hooks/useAccounts";
import { DuesPanel } from "./DuesPanel";
import { PartiesPanel } from "./PartiesPanel";
import { money } from "./shared";

const SUB_TABS = [
  { value: "ar", label: "Receivables — they owe us" },
  { value: "ap", label: "Payables — we owe them" },
  { value: "pt", label: "Parties" },
];

export function DuesTab({ range }: { range: DateRange }) {
  const [sub, setSub] = useState("ar");
  const { data: receivable } = useAgeing("RECEIVABLE");
  const { data: payable } = useAgeing("PAYABLE");

  const net = Number(receivable?.total ?? 0) - Number(payable?.total ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`rounded-card border-l-2 bg-surface px-4 py-3 text-sm ${
          net >= 0 ? "border-success" : "border-danger"
        }`}
      >
        <span className="text-secondary">Net position — </span>
        <span className="font-semibold text-text">
          {money(receivable?.total)} owed to you
        </span>
        <span className="text-secondary"> against </span>
        <span className="font-semibold text-text">
          {money(payable?.total)} you owe
        </span>
        <span className="text-secondary">, leaving </span>
        <span
          className={`font-bold ${net >= 0 ? "text-success" : "text-danger"}`}
        >
          {money(String(net))}
        </span>
      </div>

      <Tabs options={SUB_TABS} value={sub} onChange={setSub} variant="pill" />

      {sub === "ar" ? <DuesPanel kind="RECEIVABLE" range={range} /> : null}
      {sub === "ap" ? <DuesPanel kind="PAYABLE" range={range} /> : null}
      {sub === "pt" ? <PartiesPanel /> : null}
    </div>
  );
}
