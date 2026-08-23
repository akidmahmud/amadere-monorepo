"use client";

import { StatCard, Table } from "@amader/admin-ui";
import {
  useAccountsOverview,
  useAgeing,
  type AgeingReport,
  type DateRange,
} from "@/hooks/useAccounts";
import {
  BUCKET_LABEL,
  BUCKET_ORDER,
  EmptyState,
  SectionCard,
  money,
} from "./shared";

function AlertList({
  alerts,
}: {
  alerts: { severity: string; message: string }[];
}) {
  if (alerts.length === 0) {
    return <EmptyState>Nothing needs your attention.</EmptyState>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {alerts.map((a, i) => (
        <li
          key={i}
          className={`rounded-sm border-l-2 bg-surface-2 px-3 py-2 text-sm ${
            a.severity === "DANGER"
              ? "border-danger text-danger"
              : a.severity === "WARN"
                ? "border-warning text-text"
                : "border-brand-500 text-text"
          }`}
        >
          {a.message}
        </li>
      ))}
    </ul>
  );
}

function SpendBreakdown({
  rows,
}: {
  rows: { category: string; amount: string }[];
}) {
  if (rows.length === 0)
    return <EmptyState>No expenses in this range.</EmptyState>;
  // Proportional against the largest line rather than the total, so small
  // categories stay visible instead of collapsing to a sliver.
  const max = Math.max(...rows.map((r) => Number(r.amount)));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.category}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-text">{r.category}</span>
            <span className="font-semibold text-text">{money(r.amount)}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{
                width: `${max > 0 ? (Number(r.amount) / max) * 100 : 0}%`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function AgeingTable({ report }: { report: AgeingReport | undefined }) {
  if (!report) return <EmptyState>Loading…</EmptyState>;
  if (Number(report.total) === 0)
    return <EmptyState>Nothing outstanding.</EmptyState>;
  return (
    <Table>
      <thead>
        <tr>
          <th>Age</th>
          <th className="text-right">Count</th>
          <th className="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        {BUCKET_ORDER.map((bucket) => (
          <tr key={bucket}>
            <td>{BUCKET_LABEL[bucket]}</td>
            <td className="text-right">{report.buckets[bucket].count}</td>
            <td className="text-right">
              {money(report.buckets[bucket].amount)}
            </td>
          </tr>
        ))}
        <tr className="font-semibold">
          <td>Total</td>
          <td />
          <td className="text-right">{money(report.total)}</td>
        </tr>
      </tbody>
    </Table>
  );
}

export function OverviewTab({ range }: { range: DateRange }) {
  const { data } = useAccountsOverview(range);
  const { data: receivableAgeing } = useAgeing("RECEIVABLE");
  const { data: payableAgeing } = useAgeing("PAYABLE");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          variant="success"
          label="Sales"
          value={money(data?.sales)}
          footer="All channels"
        />
        <StatCard
          variant="danger"
          label="Expenses"
          value={money(data?.expenses)}
          footer="Net of VAT"
        />
        <StatCard
          variant="warning"
          label="Receivable"
          value={money(data?.receivable)}
          footer="They owe us"
        />
        <StatCard
          variant="dark"
          label="Payable"
          value={money(data?.payable)}
          footer="We owe them"
        />
        <StatCard
          variant="primary"
          label="Cash in hand"
          value={money(data?.cashInHand)}
          footer="Across all accounts"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Where the money went"
          subtitle="Net of VAT — input VAT is reclaimable"
        >
          <SpendBreakdown rows={data?.spendByCategory ?? []} />
        </SectionCard>

        <SectionCard title="Needs your attention" subtitle="Live">
          <AlertList alerts={data?.alerts ?? []} />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Receivable ageing"
          subtitle={`Who owes us · COD with courier ${money(data?.codWithCourier)}`}
        >
          <AgeingTable report={receivableAgeing} />
        </SectionCard>
        <SectionCard title="Payable ageing" subtitle="Who we owe">
          <AgeingTable report={payableAgeing} />
        </SectionCard>
      </div>
    </div>
  );
}
