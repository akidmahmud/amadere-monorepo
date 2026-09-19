"use client";

import { Suspense, useCallback, useRef, useState } from "react";
import { useCan } from "@/hooks/useAdminAuth";
import {
  useReportExceptions,
  useReportOverview,
} from "@/hooks/useSalesReportV2";
import { COLORS } from "@/components/net-profit/sales-report/format";
import { downloadXlsx } from "@/components/net-profit/sales-report/exportXlsx";
import { reportTitle } from "@/lib/reportTitle";
import type { SheetLayout } from "@/components/net-profit/sales-report/sheetStyle";
import {
  ReportFilters,
  type ExportRows,
  type TabProps,
} from "@/components/net-profit/sales-report/ReportFilters";
import { useReportFilters } from "@/components/net-profit/sales-report/useReportFilters";
import { OverviewTab } from "@/components/net-profit/sales-report/OverviewTab";
import { OrdersTab } from "@/components/net-profit/sales-report/OrdersTab";
import { AgentsTab } from "@/components/net-profit/sales-report/AgentsTab";
import { ProductsTab } from "@/components/net-profit/sales-report/ProductsTab";
import { CouriersTab } from "@/components/net-profit/sales-report/CouriersTab";
import { DistrictsTab } from "@/components/net-profit/sales-report/DistrictsTab";
import { ExceptionsTab } from "@/components/net-profit/sales-report/ExceptionsTab";
import { RatesAndCostsTab } from "@/components/net-profit/sales-report/RatesAndCostsTab";

const ALL_TABS = [
  ["overview", "Overview"],
  ["orders", "Orders"],
  ["agents", "Agents"],
  ["products", "Products"],
  ["couriers", "Couriers"],
  ["districts", "Districts"],
  ["exceptions", "Exceptions"],
  ["settings", "Rates and costs"],
] as const;
const AGENT_TABS = ["overview", "orders", "exceptions"];

function SalesReport() {
  const { f, set, reset, tab: urlTab } = useReportFilters();
  // Full view with `view`; an agent (view_own only) sees money-free tabs of their own orders.
  const money = useCan("net_profit_reports.view");
  const tabs = ALL_TABS.filter(([k]) => money || AGENT_TABS.includes(k));
  const tab = tabs.some(([k]) => k === urlTab) ? urlTab : "overview";
  const overview = useReportOverview(f);
  const exceptions = useReportExceptions(f);
  const exportRef = useRef<{
    name: string;
    rows: ExportRows | (() => Promise<ExportRows>);
    layout?: SheetLayout;
  } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [canExport, setCanExport] = useState(false);
  const onExport = useCallback<TabProps["onExport"]>((name, rows, layout) => {
    exportRef.current = rows ? { name, rows, layout } : null;
    setCanExport(!!rows);
  }, []);

  const props: TabProps = { f, setFilters: set, money, onExport };

  return (
    <div className="flex flex-col gap-3.5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        {/* The shell header already shows the breadcrumb and "Sales Report" title. */}
        <p className="text-sm" style={{ color: COLORS.ink2 }}>
          Orders, delivery cost and contribution for Amader eBuy Ltd.
        </p>
        <button
          type="button"
          disabled={!canExport || exporting}
          onClick={async () => {
            const ex = exportRef.current;
            if (!ex) return;
            setExporting(true);
            try {
              const rows =
                typeof ex.rows === "function" ? await ex.rows() : ex.rows;
              const tabLabel = tabs.find(([k]) => k === tab)?.[1];
              await downloadXlsx(
                `${ex.name}-${f.from}-to-${f.to}`,
                rows,
                ex.layout,
                reportTitle(
                  tab === "orders" || !tabLabel ? "Sales Report" : `Sales Report (${tabLabel})`,
                  f,
                ),
              );
            } finally {
              setExporting(false);
            }
          }}
          className="rounded-lg border px-3.5 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: COLORS.green, borderColor: COLORS.green }}
        >
          {exporting ? "Exporting…" : "Export Excel"}
        </button>
      </header>

      {tab !== "settings" && (
        <ReportFilters
          f={f}
          set={set}
          reset={reset}
          options={overview.data?.options}
          showAgent={money}
        />
      )}

      <nav aria-label="Report sections" className="flex flex-wrap gap-2">
        {tabs.map(([k, l]) => (
          <button
            key={k}
            type="button"
            aria-pressed={tab === k}
            onClick={() => set({ tab: k })}
            className="rounded-[9px] border px-3.5 py-1.5 text-[14.5px] font-medium"
            style={
              tab === k
                ? {
                    background: COLORS.green,
                    borderColor: COLORS.green,
                    color: "#fff",
                  }
                : {
                    borderColor: COLORS.line,
                    color: COLORS.ink2,
                    background: "#fff",
                  }
            }
          >
            {l}
            {k === "exceptions" && (exceptions.data?.total ?? 0) > 0 && (
              <span
                className="ml-1.5 inline-block rounded-full px-1.5 text-xs leading-[18px]"
                style={
                  tab === k
                    ? { background: "#fff", color: COLORS.green }
                    : { background: COLORS.loss, color: "#fff" }
                }
              >
                {exceptions.data?.total}
              </span>
            )}
          </button>
        ))}
      </nav>

      <main>
        {tab === "overview" && <OverviewTab {...props} />}
        {tab === "orders" && <OrdersTab {...props} />}
        {tab === "agents" && <AgentsTab {...props} />}
        {tab === "products" && <ProductsTab {...props} />}
        {tab === "couriers" && <CouriersTab {...props} />}
        {tab === "districts" && <DistrictsTab {...props} />}
        {tab === "exceptions" && <ExceptionsTab {...props} />}
        {tab === "settings" && <RatesAndCostsTab {...props} />}
      </main>
    </div>
  );
}

export default function SalesReportPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <SalesReport />
    </Suspense>
  );
}
