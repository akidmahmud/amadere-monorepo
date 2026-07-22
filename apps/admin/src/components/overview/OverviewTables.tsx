"use client";

import Link from "next/link";
import type { DashboardOverview } from "@/hooks/useDashboard";

// Pill/avatar hex values are ported verbatim from getcommerce-dashboard.html's
// .pill-*/.av-* classes — deliberately literal hex, not this app's --stat-*
// tokens (which come from the reference's separate ic-* icon-tile palette
// and don't match the pill colors exactly, e.g. pill-paid's text is #16a06d,
// not the icon tile's #22c087).
const STATUS_PILL: Record<string, string> = {
  COMPLETED: "bg-[#e3f7ee] text-[#16a06d]",
  PROCESSING: "bg-[#e4edfd] text-[#2b6ce6]",
  CONFIRMED: "bg-[#e4edfd] text-[#2b6ce6]",
  PENDING: "bg-[#fdf3dd] text-[#e9a23b]",
  HOLD: "bg-[#fdf3dd] text-[#e9a23b]",
  CANCELED: "bg-[#feeaec] text-[#ef4b62]",
  RETURNED: "bg-[#feeaec] text-[#ef4b62]",
  PARTIALLY_RETURNED: "bg-[#feeaec] text-[#ef4b62]",
};

const AVATAR_COLORS = ["#22c087", "#2570eb", "#8b5cf6", "#f7941d", "#f04d6a"];

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`inline-flex items-center rounded-[6px] px-2.5 py-1 text-[0.68rem] font-bold ${className}`}>{children}</span>;
}

export function RecentOrdersTable({ data }: { data: DashboardOverview }) {
  return (
    <div className="rounded-card border border-border bg-surface p-[22px] shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-ui text-sm font-semibold text-text">Recent Orders</div>
        <Link href="/net-profit/orders" className="text-[0.78rem] font-bold text-brand-500 hover:underline">
          All Orders
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Order ID", "Customer", "Amount", "Payment", "Status", "Date"].map((h) => (
                <th key={h} className="whitespace-nowrap border-b border-border px-2.5 py-2.5 text-left text-[0.72rem] font-bold text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.recentOrders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2.5 py-6 text-center text-sm text-muted">
                  No orders yet.
                </td>
              </tr>
            )}
            {data.recentOrders.map((o) => (
              <tr key={o.id} className="border-b border-[#f1f5fa] last:border-b-0 hover:bg-[#f8fafd]">
                <td className="whitespace-nowrap px-2.5 py-[13px] text-[0.78rem] font-bold text-text">#{o.orderNumber}</td>
                <td className="whitespace-nowrap px-2.5 py-[13px] text-[0.78rem] font-semibold text-text">{o.customerName}</td>
                <td className="whitespace-nowrap px-2.5 py-[13px] text-[0.78rem] font-semibold text-text">৳{Number(o.total).toLocaleString()}</td>
                <td className="whitespace-nowrap px-2.5 py-[13px]">
                  <Pill className={o.paymentMethod === "COD" ? "bg-[#fdeedd] text-[#e0821c]" : "bg-[#e3f7ee] text-[#16a06d]"}>
                    {o.paymentMethod === "COD" ? "COD" : "Paid"}
                  </Pill>
                </td>
                <td className="whitespace-nowrap px-2.5 py-[13px]">
                  <Pill className={STATUS_PILL[o.status] ?? "bg-surface-2 text-secondary"}>{o.status}</Pill>
                </td>
                <td className="whitespace-nowrap px-2.5 py-[13px] text-[0.78rem] font-semibold text-text">
                  {new Date(o.createdAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                </td>
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
        <Link href="/customers" className="text-[0.78rem] font-bold text-brand-500 hover:underline">
          All Customers
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="whitespace-nowrap border-b border-border px-2.5 py-2.5 text-left text-[0.72rem] font-bold text-muted">Customer</th>
              <th className="whitespace-nowrap border-b border-border px-2.5 py-2.5 text-left text-[0.72rem] font-bold text-muted">Orders</th>
              <th className="whitespace-nowrap border-b border-border px-2.5 py-2.5 text-right text-[0.72rem] font-bold text-muted">Total Spending</th>
            </tr>
          </thead>
          <tbody>
            {data.topCustomers.length === 0 && (
              <tr>
                <td colSpan={3} className="px-2.5 py-6 text-center text-sm text-muted">
                  No orders yet.
                </td>
              </tr>
            )}
            {data.topCustomers.map((c, i) => (
              <tr key={c.id} className="border-b border-[#f1f5fa] last:border-b-0 hover:bg-[#f8fafd]">
                <td className="whitespace-nowrap px-2.5 py-[13px]">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full text-[0.72rem] font-extrabold text-white"
                      style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                    >
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-[0.78rem] font-semibold text-text">{c.name}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-2.5 py-[13px] text-[0.78rem] font-semibold text-text">{c.orderCount}</td>
                <td className="whitespace-nowrap px-2.5 py-[13px] text-right text-[0.78rem] font-bold text-text">
                  ৳{Number(c.totalSpend).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
