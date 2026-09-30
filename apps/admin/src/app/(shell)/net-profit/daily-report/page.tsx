"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs } from "@amader/admin-ui";
import { useCan } from "@/hooks/useAdminAuth";
import { ReportsList } from "@/components/net-profit/daily-report/ReportsList";
import { SettingsPanel } from "@/components/net-profit/daily-report/SettingsPanel";

const PATH = "/net-profit/daily-report";

function DailyReportPage() {
  const manage = useCan("net_profit_daily_report.manage");
  const router = useRouter();
  const params = useSearchParams();
  const tab =
    manage && params.get("tab") === "settings" ? "settings" : "reports";
  return (
    // accounts-scope: green like the Sales Report and Accounts, not Net
    // Profit's violet (see packages/admin-ui/src/globals.css).
    <div className="accounts-scope flex flex-col gap-4">
      {manage && (
        <Tabs
          variant="pill"
          value={tab}
          onChange={(v) =>
            router.replace(v === "settings" ? `${PATH}?tab=settings` : PATH)
          }
          options={[
            { value: "reports", label: "Reports" },
            { value: "settings", label: "Settings" },
          ]}
        />
      )}
      {tab === "settings" ? (
        <SettingsPanel />
      ) : (
        <ReportsList canManage={manage} />
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <DailyReportPage />
    </Suspense>
  );
}
