"use client";

import Link from "next/link";
import { Table, TableEmptyRow } from "@amader/admin-ui";
import type { DashboardOverview } from "@/hooks/useDashboard";

const STATUS_PILL: Record<string, string> = {
  COMPLETED: "bg-stat-green-bg text-stat-green",
  PROCESSING: "bg-brand-50 text-brand-500",
  PENDING: "bg-stat-yellow-bg text-stat-yellow",
  CONFIRMED: "bg-brand-50 text-brand-500",
  CANCELED: "bg-stat-red-bg text-stat-red",
};

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`inline-flex items-center rounded-inner px-2.5 py-1 text-[11px] font-bold ${className}`}>{children}</span>;
}

export function RecentOrdersTable({ data }: { data: DashboardOverview }) {
  return (
    <div className="rounded-card border border-border bg-surface p-[22px] shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-ui text-sm font-semibold text-text">Recent Orders</div>
        <Link href="/net-profit/orders" className="text-xs font-bold text-brand-500 hover:underline">
          All Orders
        </Link>
      </div>
      <div className="wpfok-table-scroll">
        <table className="wpfok-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {data.recentOrders.length === 0 && <TableEmptyRow colSpan={6}>No orders yet.</TableEmptyRow>}
            {data.recentOrders.map((o) => (
              <tr key={o.id}>
                <td className="font-bold text-text">#{o.orderNumber}</td>
                <td>{o.customerName}</td>
                <td>৳{Number(o.total).toLocaleString()}</td>
                <td>
                  <Pill className={o.paymentMethod === "COD" ? "bg-stat-orange-bg text-stat-orange" : "bg-stat-green-bg text-stat-green"}>
                    {o.paymentMethod}
                  </Pill>
                </td>
                <td>
                  <Pill className={STATUS_PILL[o.status] ?? "bg-surface-2 text-secondary"}>{o.status}</Pill>
                </td>
                <td>{new Date(o.createdAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TopCustomersTable({ data }: { data: DashboardOverview }) {
  return (
    <div className="rounded-card border border-border bg-surface p-[22px] shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-ui text-sm font-semibold text-text">Top Customers</div>
        <Link href="/customers" className="text-xs font-bold text-brand-500 hover:underline">
          All Customers
        </Link>
      </div>
      <div className="wpfok-table-scroll">
        <table className="wpfok-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Orders</th>
              <th className="text-right">Total Spending</th>
            </tr>
          </thead>
          <tbody>
            {data.topCustomers.length === 0 && <TableEmptyRow colSpan={3}>No orders yet.</TableEmptyRow>}
            {data.topCustomers.map((c) => (
              <tr key={c.id}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 place-items-center rounded-pill bg-brand-500 text-xs font-bold text-white">
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                    {c.name}
                  </div>
                </td>
                <td>{c.orderCount}</td>
                <td className="text-right font-bold text-text">৳{Number(c.totalSpend).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
