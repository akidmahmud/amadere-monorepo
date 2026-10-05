"use client";

import { use } from "react";
import { reportWindowLabel } from "@amader/shared";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { dailyReportExportUrl, useDailyReport } from "@/hooks/useDailyReports";
import { ReportSheet } from "@/components/net-profit/daily-report/ReportSheet";
import { MissingCostNotice } from "@/components/net-profit/daily-report/MissingCostNotice";
import { money } from "@/components/net-profit/daily-report/format";

const Delta = ({ now, before }: { now: number; before: number }) => {
  const d = now - before;
  return (
    <span className={d < 0 ? "text-danger" : "text-brand-500"}>
      {d >= 0 ? "+" : ""}
      {money(d)}
    </span>
  );
};

function DailyReportBody({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = useDailyReport(Number(id));

  if (q.isLoading) return <Card>Loading…</Card>;
  if (q.error || !q.data)
    return (
      <Card className="flex flex-col gap-3">
        <p className="text-danger">
          {q.error ? (q.error as Error).message : "Report not found."}
        </p>
        <Link
          href="/net-profit/daily-report"
          className="text-brand-500 hover:underline"
        >
          ← All reports
        </Link>
      </Card>
    );
  const r = q.data;
  const s = r.snapshot;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/net-profit/daily-report"
            className="text-xs text-brand-500 hover:underline"
          >
            ← All reports
          </Link>
          <h2 className="mt-1 text-lg font-bold">{r.name}</h2>
          <p className="text-sm text-muted">
            {reportWindowLabel(r.windowStart, r.windowEnd)} ·{" "}
            {r.kind === "AUTO"
              ? "Automatic"
              : `Manual, by ${r.createdByName ?? "—"}`}{" "}
            · generated{" "}
            {new Date(s.generatedAt).toLocaleString("en-GB", {
              timeZone: "Asia/Dhaka",
            })}
          </p>
          {r.previous && (
            <p className="mt-1 text-sm">
              vs{" "}
              <Link
                href={`/net-profit/daily-report/${r.previous.id}`}
                className="text-brand-500 hover:underline"
              >
                previous day
              </Link>
              : sales{" "}
              <Delta now={r.totalSales} before={r.previous.totalSales} />, net
              profit <Delta now={r.netProfit} before={r.previous.netProfit} />
            </p>
          )}
        </div>
        <a href={dailyReportExportUrl(r.id)}>
          <Button>Export Excel</Button>
        </a>
      </Card>

      <MissingCostNotice s={s} />

      {r.changed.orders > 0 && (
        <div className="rounded-sm border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {r.changed.orders} order{r.changed.orders > 1 ? "s" : ""} (৳
          {money(r.changed.amount)}) were cancelled, returned or deleted after
          this report was generated. The report below is unchanged. Generate a
          new one to see current figures.
        </div>
      )}

      <Card>
        <ReportSheet s={s} />
      </Card>
    </div>
  );
}

// accounts-scope: green like the Sales Report and Accounts (globals.css).
export default function DailyReportView(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="accounts-scope">
      <DailyReportBody {...props} />
    </div>
  );
}
