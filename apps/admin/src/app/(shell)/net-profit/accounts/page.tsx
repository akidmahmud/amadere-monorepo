"use client";

import { useState } from "react";
import {
  Card,
  Field,
  Icon,
  PageHeader,
  Tabs,
  fieldInputClass,
} from "@amader/admin-ui";
import type { DateRange } from "@/hooks/useAccounts";
import { OverviewTab } from "./_components/OverviewTab";
import { ExpensesTab } from "./_components/ExpensesTab";
import { DuesTab } from "./_components/DuesTab";
import { VatCashFlowTab } from "./_components/VatCashFlowTab";
import { firstOfMonth, today } from "./_components/shared";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "expenses", label: "Expenses" },
  { value: "dues", label: "Dues" },
  { value: "vat", label: "VAT & Cash Flow" },
];

export default function AccountsPage() {
  const [tab, setTab] = useState("overview");
  const [range, setRange] = useState<DateRange>({
    from: firstOfMonth(),
    to: today(),
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<Icon name="account_balance" />}
        title="Accounts"
        subtitle="Expenses, dues, VAT (Mushak) and cash flow."
      />

      <Card className="flex flex-wrap items-end gap-3">
        <Field label="From">
          <input
            type="date"
            value={range.from ?? ""}
            onChange={(e) =>
              setRange({ ...range, from: e.target.value || undefined })
            }
            className={fieldInputClass}
          />
        </Field>
        <Field label="To">
          <input
            type="date"
            value={range.to ?? ""}
            onChange={(e) =>
              setRange({ ...range, to: e.target.value || undefined })
            }
            className={fieldInputClass}
          />
        </Field>
      </Card>

      <Tabs options={TABS} value={tab} onChange={setTab} />

      {tab === "overview" ? <OverviewTab range={range} /> : null}
      {tab === "expenses" ? <ExpensesTab range={range} /> : null}
      {tab === "dues" ? <DuesTab range={range} /> : null}
      {tab === "vat" ? <VatCashFlowTab range={range} /> : null}
    </div>
  );
}
