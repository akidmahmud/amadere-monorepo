"use client";

import type { DateRange } from "@/hooks/useAccounts";
import { AccountingSettingsPanel } from "./AccountingSettingsPanel";
import { AccountsMastersPanel } from "./AccountsMastersPanel";
import { CashAccountsPanel } from "./CashAccountsPanel";

export function SetupTab({ range }: { range: DateRange }) {
  return (
    <div className="flex flex-col gap-4">
      <CashAccountsPanel range={range} />
      <AccountsMastersPanel />
      <AccountingSettingsPanel />
    </div>
  );
}
