"use client";

import { useState } from "react";
import { Button, Icon, PageHeader, StatCard, Table, TableEmptyRow } from "@amader/admin-ui";
import { useCustomers, useCustomerTierCounts } from "@/hooks/useCustomers";
import { CustomerDetailModal } from "@/components/CustomerDetailModal";

const customersIcon = <Icon name="people" />;
const PAGE_SIZE = 50;

export default function CustomersPage() {
  const [q, setQ] = useState("");
  const [tierId, setTierId] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data: tierCounts } = useCustomerTierCounts();
  const { data } = useCustomers({ q: q || undefined, tierId, page, pageSize: PAGE_SIZE });
  // pageSize:1 is enough to read the real total — a real DB count, not a
  // fetch-and-filter over up to 1000 rows (which previously showed 0 for
  // every tier stat card once tiered customers fell outside that window).
  const { data: totalOnly } = useCustomers({ pageSize: 1 });
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  function updateQ(value: string) {
    setQ(value);
    setPage(1);
  }

  function updateTierId(value: number | undefined) {
    setTierId(value);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={customersIcon} title="Customers" subtitle="Every customer, auto-created from orders." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard variant="dark" icon={customersIcon} label="Total Customers" value={String(totalOnly?.total ?? 0)} />
        {(tierCounts ?? []).map((tier) => (
          <StatCard key={tier.id} variant="primary" icon={customersIcon} label={tier.label} value={String(tier.count)} />
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Search</span>
          <input
            value={q}
            onChange={(e) => updateQ(e.target.value)}
            placeholder="Name, phone, or email…"
            className="h-10 w-64 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Tier</span>
          <select
            value={tierId ?? ""}
            onChange={(e) => updateTierId(e.target.value ? Number(e.target.value) : undefined)}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          >
            <option value="">All</option>
            {(tierCounts ?? []).map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Tier</th>
            <th>Completed Orders</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {(data?.items ?? []).length === 0 && <TableEmptyRow colSpan={6}>No customers found.</TableEmptyRow>}
          {(data?.items ?? []).map((c) => (
            <tr key={c.id}>
              <td>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className="font-semibold text-brand-500 hover:underline"
                >
                  {c.name}
                </button>
              </td>
              <td className="num text-text">{c.phone ?? "—"}</td>
              <td className="text-xs text-muted">{c.email ?? "—"}</td>
              <td>
                {c.tier ? (
                  <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-secondary">{c.tier}</span>
                ) : (
                  "—"
                )}
              </td>
              <td className="num text-text">{c.completedOrderCount}</td>
              <td className="text-xs text-muted">{new Date(c.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <div className="flex items-center justify-between">
        <span className="text-xs text-secondary">
          {data && data.total > 0
            ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, data.total)} of ${data.total}`
            : null}
        </span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="text-xs text-secondary">
            Page {page} of {totalPages}
          </span>
          <Button type="button" variant="ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      </div>

      {selectedId && <CustomerDetailModal customerId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
