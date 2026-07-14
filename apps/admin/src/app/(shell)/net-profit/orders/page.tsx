"use client";

import { useState } from "react";
import { Button, Card, RiskBadge } from "@amader/admin-ui";
import type { RiskLevel as RiskBadgeLevel } from "@amader/admin-ui";
import { useBulkOrderAction, useOrderManagerList, type OrderManagerFilters } from "@/hooks/useOrderManager";
import { useOrderStatusConfigs } from "@/hooks/useOrderStatuses";

const STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "COMPLETED", "CANCELED", "PARTIALLY_RETURNED", "RETURNED", "HOLD"];
const PAYMENT_PROVIDERS = ["COD", "BKASH", "NAGAD", "SSLCOMMERZ", "BANK_TRANSFER"];
const COURIER_PROVIDERS = ["STEADFAST", "PATHAO", "REDX", "ECOURIER"];
const RISK_LEVELS: RiskBadgeLevel[] = ["LOW", "MEDIUM", "HIGH", "UNKNOWN"];

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function OrderManagerPage() {
  const [filters, setFilters] = useState<OrderManagerFilters>({});
  const { data, isLoading } = useOrderManagerList(filters);
  const { data: statusConfigs } = useOrderStatusConfigs();
  const bulk = useBulkOrderAction();
  const statusByKey = new Map((statusConfigs ?? []).map((s) => [s.status, s]));

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [consignProvider, setConsignProvider] = useState(COURIER_PROVIDERS[0]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!data) return;
    setSelected((prev) => (prev.size === data.items.length ? new Set() : new Set(data.items.map((o) => o.id))));
  }

  function runBulk(action: "consign" | "block" | "hold" | "export") {
    if (selected.size === 0) return;
    bulk.mutate(
      { orderIds: [...selected], action, courierProvider: action === "consign" ? consignProvider : undefined },
      {
        onSuccess: (result) => {
          if (result.csv) downloadCsv(result.csv, `orders-${Date.now()}.csv`);
          if (result.failed.length > 0) {
            alert(`${result.succeeded.length} succeeded, ${result.failed.length} failed:\n${result.failed.map((f) => `#${f.orderId}: ${f.error}`).join("\n")}`);
          }
          setSelected(new Set());
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Status</span>
          <select
            value={filters.status ?? ""}
            onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Payment</span>
          <select
            value={filters.paymentProvider ?? ""}
            onChange={(e) => setFilters({ ...filters, paymentProvider: e.target.value || undefined })}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          >
            <option value="">All</option>
            {PAYMENT_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Courier</span>
          <select
            value={filters.courierProvider ?? ""}
            onChange={(e) => setFilters({ ...filters, courierProvider: e.target.value || undefined })}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          >
            <option value="">All</option>
            {COURIER_PROVIDERS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Risk</span>
          <select
            value={filters.risk ?? ""}
            onChange={(e) => setFilters({ ...filters, risk: (e.target.value as RiskBadgeLevel) || undefined })}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          >
            <option value="">All</option>
            {RISK_LEVELS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Division</span>
          <input
            value={filters.division ?? ""}
            onChange={(e) => setFilters({ ...filters, division: e.target.value || undefined })}
            placeholder="Dhaka"
            className="h-10 w-32 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <span className="ml-auto text-xs text-muted">{data?.total ?? 0} orders</span>
      </Card>

      {selected.size > 0 && (
        <Card className="flex flex-wrap items-center gap-3 bg-brand-50">
          <span className="text-sm font-semibold text-text">{selected.size} selected</span>
          <select
            value={consignProvider}
            onChange={(e) => setConsignProvider(e.target.value)}
            className="h-9 rounded-sm border border-border bg-surface px-2 text-sm text-text outline-none"
          >
            {COURIER_PROVIDERS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Button type="button" variant="primary" disabled={bulk.isPending} onClick={() => runBulk("consign")}>
            Consign
          </Button>
          <Button type="button" variant="ghost" disabled={bulk.isPending} onClick={() => runBulk("hold")}>
            Hold
          </Button>
          <Button type="button" variant="ghost" disabled={bulk.isPending} onClick={() => runBulk("block")}>
            Block phone
          </Button>
          <Button type="button" variant="ghost" disabled={bulk.isPending} onClick={() => runBulk("export")}>
            Export CSV
          </Button>
        </Card>
      )}

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {data && data.items.length === 0 && <p className="text-sm text-muted">No orders match these filters.</p>}

      <div className="flex flex-col gap-2">
        {data && data.items.length > 0 && (
          <label className="flex items-center gap-2 px-1 text-xs text-secondary">
            <input type="checkbox" checked={selected.size === data.items.length} onChange={toggleAll} />
            Select all on this page
          </label>
        )}
        {data?.items.map((o) => {
          const statusConfig = statusByKey.get(o.status);
          return (
          <Card key={o.id} className="flex items-center gap-3">
            <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
            <span className="num flex-1 text-sm text-text">{o.orderNumber}</span>
            <span
              className="rounded-pill px-2.5 py-1 text-xs font-semibold"
              style={{ backgroundColor: `${statusConfig?.color ?? "#9ca3af"}1a`, color: statusConfig?.color ?? "#9ca3af" }}
            >
              {statusConfig?.labelEn ?? o.status}
            </span>
            <span className="text-xs text-secondary">{o.paymentProvider ?? "—"}</span>
            <span className="text-xs text-secondary">{o.courierProvider ?? "—"}</span>
            <span className="text-xs text-secondary">{o.division ?? "—"}</span>
            <RiskBadge level={o.riskLevel} />
            <span className="text-sm font-semibold text-text">৳{Number(o.totalAmount).toLocaleString()}</span>
          </Card>
          );
        })}
      </div>
    </div>
  );
}
