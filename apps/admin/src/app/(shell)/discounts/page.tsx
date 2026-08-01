"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Icon, PageHeader } from "@amader/admin-ui";
import { useBulkDeleteDiscounts, useDeleteDiscount, useDiscounts, type AdminDiscount } from "@/hooks/useDiscounts";

const discountIcon = <Icon name="local_offer" />;
const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

function valueLabel(discount: AdminDiscount): string {
  if (discount.valueType === "FREE_SHIPPING") return "Free shipping";
  if (discount.valueType === "PERCENTAGE") return `${discount.value}%`;
  return `৳${discount.value}`;
}

// Matches amadere.com's admin "Detail" column: a colored summary card
// instead of a plain code string, so the discount's actual effect reads at
// a glance without opening it. Scope/min-order phrasing is generated from
// our own schema (product/category restriction, minOrderAmount) rather than
// Botble's exact wording, since our targeting model isn't identical.
function discountSummary(discount: AdminDiscount): string {
  const scope =
    discount.productIds.length > 0
      ? `${discount.productIds.length} selected product${discount.productIds.length === 1 ? "" : "s"}`
      : discount.categoryIds.length > 0
        ? `${discount.categoryIds.length} selected categor${discount.categoryIds.length === 1 ? "y" : "ies"}`
        : "all orders";
  const minOrder = discount.minOrderAmount ? ` (min. order ৳${discount.minOrderAmount})` : "";
  if (discount.valueType === "FREE_SHIPPING") return `Free shipping for ${scope}${minOrder}`;
  return `Discount ${valueLabel(discount)} for ${scope}${minOrder}`;
}

function isExpired(discount: AdminDiscount): boolean {
  return !!discount.endsAt && new Date(discount.endsAt) < new Date();
}

function DetailCard({ discount }: { discount: AdminDiscount }) {
  const expired = isExpired(discount);
  return (
    <div
      className={`relative rounded-inner border px-4 py-3 ${
        expired ? "border-border bg-surface-2 text-muted line-through" : "border-success/30 bg-success/10"
      }`}
    >
      {expired && (
        <span className="absolute right-2 top-2 rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-bold text-danger no-underline">
          Expired
        </span>
      )}
      <p className={`text-sm font-bold ${expired ? "" : "text-success"}`}>
        {discount.code ? `Coupon code: ${discount.code}` : `Promotion #${discount.id}`}
      </p>
      <p className={`text-sm ${expired ? "" : "text-text"}`}>{discountSummary(discount)}</p>
    </div>
  );
}

export default function DiscountsPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<number[]>([]);

  const { data, isLoading } = useDiscounts({ q: q || undefined, page, pageSize });
  const deleteDiscount = useDeleteDiscount();
  const bulkDelete = useBulkDeleteDiscounts();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const allSelected = items.length > 0 && items.every((d) => selected.includes(d.id));

  function toggleAll() {
    setSelected(allSelected ? [] : items.map((d) => d.id));
  }

  function toggleOne(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  function handleBulkDelete() {
    if (selected.length === 0) return;
    if (!confirm(`Delete ${selected.length} discount(s)?`)) return;
    bulkDelete.mutate(selected, { onSuccess: () => setSelected([]) });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={discountIcon}
        title="Discounts"
        subtitle="Coupon codes and auto-applied promotions."
        style={{ background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" }}
      />

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              placeholder="Search by code…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className={`${inputClass} w-64`}
            />
            <span className="text-sm text-secondary">{total} discount{total === 1 ? "" : "s"}</span>
          </div>
          <div className="flex items-center gap-2">
            {selected.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                disabled={bulkDelete.isPending}
                onClick={handleBulkDelete}
                className="border-danger text-danger hover:bg-danger/10"
              >
                Delete selected ({selected.length})
              </Button>
            )}
            <Link href="/discounts/new">
              <Button type="button" variant="primary">
                <Icon name="add" size={16} /> Create
              </Button>
            </Link>
          </div>
        </div>

        {isLoading && <p className="text-sm text-muted">Loading…</p>}
        {!isLoading && items.length === 0 && <p className="text-sm text-muted">No discounts yet.</p>}

        {items.length > 0 && (
          <div className="overflow-x-auto rounded-inner border border-border">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-xs font-semibold uppercase tracking-wide text-secondary">
                  <th className="w-10 px-3 py-2.5">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  </th>
                  <th className="px-3 py-2.5">ID</th>
                  <th className="px-3 py-2.5">Detail</th>
                  <th className="px-3 py-2.5">Used</th>
                  <th className="px-3 py-2.5">Start Date</th>
                  <th className="px-3 py-2.5">End Date</th>
                  <th className="w-20 px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5 align-top">
                      <input type="checkbox" checked={selected.includes(d.id)} onChange={() => toggleOne(d.id)} />
                    </td>
                    <td className="px-3 py-2.5 align-top text-muted">{d.id}</td>
                    <td className="px-3 py-2.5">
                      <DetailCard discount={d} />
                    </td>
                    <td className="px-3 py-2.5 align-top text-text">
                      {d.usedCount}
                      {d.maxUsesTotal ? `/${d.maxUsesTotal}` : ""}
                    </td>
                    <td className="px-3 py-2.5 align-top text-muted">
                      {d.startsAt ? new Date(d.startsAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 py-2.5 align-top text-muted">
                      {d.endsAt ? new Date(d.endsAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex items-center gap-2">
                        <Link href={`/discounts/${d.id}`} aria-label="Edit discount" className="text-success hover:opacity-70">
                          <Icon name="edit" size={18} />
                        </Link>
                        <button
                          type="button"
                          aria-label="Delete discount"
                          disabled={deleteDiscount.isPending}
                          onClick={() => {
                            if (confirm(`Delete "${d.code ?? `Promotion #${d.id}`}"?`)) deleteDiscount.mutate(d.id);
                          }}
                          className="text-danger hover:opacity-70"
                        >
                          <Icon name="delete" size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="flex items-center justify-between text-sm text-secondary">
            <div className="flex items-center gap-2">
              <span>
                Showing {start}–{end} of {total}
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className={inputClass}
              >
                {[20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n} / page</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span>Page {page} of {totalPages}</span>
              <Button type="button" variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
