"use client";

import { useState } from "react";
import { useAssignableStaff } from "@/hooks/useCustomers";
import { LEAD_OUTCOME_LABEL, useLeadDashboard, type LeadCallOutcome } from "@/hooks/useLeads";

const GREEN = "#2e7d43";
const LINE = "#e5ebe6";
const INK = "#1e2b22";
const MUTED = "#64766b";
const money = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;
const iso = (d: Date) => new Date(d.getTime() + 6 * 3_600_000).toISOString().slice(0, 10);

function Kpi({ value, label, tone }: { value: string; label: string; tone?: "green" | "warn" | "red" }) {
  const color = tone === "green" ? GREEN : tone === "warn" ? "#c2410c" : tone === "red" ? "#be123c" : INK;
  return (
    <div className="rounded-card border bg-white p-4 shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ borderColor: LINE }}>
      <div className="text-2xl font-extrabold" style={{ color }}>
        {value}
      </div>
      <div className="mt-1 text-[0.76rem] font-semibold" style={{ color: MUTED }}>
        {label}
      </div>
    </div>
  );
}

function Card({ title, children, full }: { title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div
      className={`rounded-card border bg-white p-4 shadow-[0_1px_2px_rgba(20,40,25,.05)] ${full ? "lg:col-span-3" : ""}`}
      style={{ borderColor: LINE }}
    >
      <h3 className="mb-3 text-sm font-extrabold" style={{ color: INK }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Bars({ rows, labels }: { rows: { label: string; count: number }[]; labels?: Record<string, string> }) {
  if (!rows.length) return <p className="py-4 text-center text-sm" style={{ color: MUTED }}>No data in this period</p>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_120px_32px] items-center gap-2 text-[0.78rem]">
          <span className="truncate" style={{ color: INK }} title={labels?.[r.label] ?? r.label}>
            {labels?.[r.label] ?? r.label}
          </span>
          <span className="h-2.5 rounded-full bg-[#eef3ef]">
            <span className="block h-full rounded-full" style={{ width: `${(r.count / max) * 100}%`, background: GREEN }} />
          </span>
          <span className="text-right font-bold" style={{ color: INK }}>
            {r.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Calls per day: answered (green) on top of not reached (pale). */
function CallsChart({ days }: { days: { day: string; answered: number; notReached: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.answered + d.notReached));
  return (
    <div>
      <div className="flex h-40 items-end gap-[3px]">
        {days.map((d) => {
          const total = d.answered + d.notReached;
          return (
            <div key={d.day} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.day}: ${total} calls, ${d.answered} answered`}>
              {total > 0 && (
                <span className="mb-0.5 text-center text-[0.6rem] font-bold" style={{ color: MUTED }}>
                  {total}
                </span>
              )}
              <span className="block rounded-t-[3px] bg-[#cfe3d4]" style={{ height: `${(d.notReached / max) * 100}%` }} />
              <span className="block" style={{ height: `${(d.answered / max) * 100}%`, background: GREEN }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[0.66rem]" style={{ color: MUTED }}>
        <span>{days[0]?.day.slice(5).split("-").reverse().join("/")}</span>
        <span>{days.at(-1)?.day.slice(5).split("-").reverse().join("/")}</span>
      </div>
      <div className="mt-2 flex gap-4 text-[0.72rem]" style={{ color: MUTED }}>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: GREEN }} /> Answered
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#cfe3d4]" /> Not reached
        </span>
      </div>
    </div>
  );
}

export function LeadDashboard() {
  const [days, setDays] = useState(30);
  const [agentId, setAgentId] = useState<number | undefined>();
  const { data: staff } = useAssignableStaff();
  const to = iso(new Date());
  const from = iso(new Date(Date.now() - (days - 1) * 86_400_000));
  const { data, isLoading, error } = useLeadDashboard({ from, to, agentId });
  const per = ` (last ${days} days)`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="h-10 rounded-[10px] border bg-white px-3 text-[0.8rem] font-semibold"
          style={{ borderColor: LINE }}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        <select
          value={agentId ?? ""}
          onChange={(e) => setAgentId(e.target.value ? Number(e.target.value) : undefined)}
          className="h-10 rounded-[10px] border bg-white px-3 text-[0.8rem] font-semibold"
          style={{ borderColor: LINE }}
        >
          <option value="">All agents</option>
          {(staff ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading || !data ? (
        <p className="text-sm" style={{ color: MUTED }}>
          {error ? (error as Error).message : "Loading…"}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Kpi value={String(data.kpis.newLeads)} label="New leads" />
            <Kpi
              value={String(data.kpis.firstOrders)}
              label={`First orders (new customers) · ${data.kpis.firstOrdersOfCalledPct}% of called leads`}
              tone="green"
            />
            <Kpi value={String(data.kpis.repeatOrders)} label="Repeat orders" tone="green" />
            <Kpi value={money(data.kpis.orderValue)} label="Order value" />
            <Kpi value={String(data.kpis.calls)} label={`Calls · ${data.kpis.answeredPct}% answered`} />
            <Kpi value={String(data.kpis.followUpsDue)} label="Follow-ups due or overdue" tone="warn" />
            <Kpi value={String(data.kpis.doNotCall)} label="Blocked as Do not call" tone="red" />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Card title={`Calls per day${per}`} full>
              <CallsChart days={data.callsPerDay} />
            </Card>
            <Card title={`Call outcomes${per}`}>
              <Bars rows={data.callOutcomes} labels={LEAD_OUTCOME_LABEL as Record<LeadCallOutcome, string>} />
            </Card>
            <Card title={`First orders by lead source${per}`}>
              <Bars rows={data.firstOrdersBySource} />
            </Card>
            <Card title={`Lost reasons${per}`}>
              <Bars rows={data.lostReasons} />
            </Card>
            <Card title="Customers by last order">
              <Bars rows={data.customersByLastOrder} />
              <p className="mt-2 text-[0.72rem]" style={{ color: MUTED }}>
                At Risk and Dormant customers are your win-back list.
              </p>
            </Card>
            <Card title={`Agent performance${per}`} full>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-[0.8rem]">
                  <thead>
                    <tr className="text-left text-white" style={{ background: GREEN }}>
                      {["Agent", "Open leads", "Calls made", "Answered", "First orders", "Repeat orders", "Order value", "Due now"].map((h) => (
                        <th key={h} className="px-3 py-2.5 font-bold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.agentPerformance.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center" style={{ color: MUTED }}>
                          No activity in this period
                        </td>
                      </tr>
                    )}
                    {data.agentPerformance.map((a) => (
                      <tr key={a.agentId} className="border-b" style={{ borderColor: LINE }}>
                        <td className="px-3 py-2.5 font-bold" style={{ color: INK }}>
                          {a.agent}
                        </td>
                        <td className="px-3 py-2.5">{a.openLeads}</td>
                        <td className="px-3 py-2.5">{a.callsMade}</td>
                        <td className="px-3 py-2.5">{a.callsMade ? `${Math.round((a.answered / a.callsMade) * 100)}%` : "—"}</td>
                        <td className="px-3 py-2.5">{a.firstOrders}</td>
                        <td className="px-3 py-2.5">{a.repeatOrders}</td>
                        <td className="px-3 py-2.5">{money(a.orderValue)}</td>
                        <td className="px-3 py-2.5">{a.dueNow}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[0.72rem]" style={{ color: MUTED }}>
                Calls count under the agent who logged them; orders under the agent assigned to the order.
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
