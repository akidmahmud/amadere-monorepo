"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCategories } from "@/hooks/useCategories";
import { useDeleteProduct, type AdminProduct, type AdminProductFilters } from "@/hooks/useProducts";

const STATUS_PILL: Record<string, string> = {
  PUBLISHED: "bg-[#e3f7ee] text-[#16a06d]",
  DRAFT: "bg-[#f1eafe] text-[#8b5cf6]",
  ARCHIVED: "bg-surface-2 text-secondary",
  PENDING: "bg-[#fdf1dc] text-[#e0821c]",
};

const STOCK_PILL: Record<string, string> = {
  IN_STOCK: "bg-[#e3f7ee] text-[#16a06d]",
  OUT_OF_STOCK: "bg-[#feeaec] text-[#e8465e]",
  ON_BACKORDER: "bg-[#fdf1dc] text-[#e0821c]",
};

const STOCK_LABEL: Record<string, string> = {
  IN_STOCK: "In Stock",
  OUT_OF_STOCK: "Out of Stock",
  ON_BACKORDER: "On Backorder",
};

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`inline-flex items-center rounded-[6px] px-2.5 py-1 text-[0.68rem] font-bold ${className}`}>{children}</span>;
}

// Same hand-rolled SVG-ring technique as the reference's own static
// `.seo-ring` markup — the reference itself doesn't animate these, only its
// big Sales-by-Source donut on the dashboard did, so no charting library
// is needed here either.
function SeoRing({ score }: { score?: number }) {
  if (score === undefined) return <span className="text-[0.7rem] font-bold text-muted">—</span>;
  const r = 16;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);
  const color = score >= 80 ? "#22c087" : score >= 50 ? "#f7941d" : "#ef4b62";
  return (
    <div className="relative h-[38px] w-[38px]">
      <svg width="38" height="38" viewBox="0 0 38 38" className="-rotate-90">
        <circle cx="19" cy="19" r={r} fill="none" stroke="#e9eef5" strokeWidth="3.5" />
        <circle cx="19" cy="19" r={r} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[0.66rem] font-extrabold text-text">{score}</span>
    </div>
  );
}

const PAGE_SIZES = [10, 25, 50];

export function ProductsTable({
  products,
  total,
  filters,
  onFiltersChange,
}: {
  products: AdminProduct[];
  total: number;
  filters: AdminProductFilters;
  onFiltersChange: (next: AdminProductFilters) => void;
}) {
  const router = useRouter();
  const { data: categories } = useCategories();
  const categoryName = new Map((categories ?? []).map((c) => [c.id, c.translations[0]?.name ?? c.slug]));

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  function toggleExpanded(id: number) {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  }
  const [bulkAction, setBulkAction] = useState("");
  const deleteProduct = useDeleteProduct();

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function toggleAll() {
    setSelected(selected.size === products.length ? new Set() : new Set(products.map((p) => p.id)));
  }
  function toggleOne(id: number) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  async function applyBulkAction() {
    if (!bulkAction || selected.size === 0) return;
    const ids = [...selected];
    if (bulkAction === "delete") {
      if (!confirm(`Delete ${ids.length} product(s)?`)) return;
      await Promise.all(ids.map((id) => deleteProduct.mutateAsync(id)));
    } else if (bulkAction === "activate" || bulkAction === "draft") {
      const status = bulkAction === "activate" ? "PUBLISHED" : "DRAFT";
      await Promise.all(
        ids.map((id) => fetch(`/api/backend/admin/products/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status } as never) })),
      );
    }
    setSelected(new Set());
    setBulkAction("");
    router.refresh();
  }

  function exportHref() {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v === undefined || v === "" || k === "page" || k === "pageSize") continue;
      if (Array.isArray(v)) v.forEach((x) => params.append(k, String(x)));
      else params.set(k, String(v));
    }
    return `/api/backend/admin/products/export?${params.toString()}`;
  }

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="rounded-card border border-border bg-surface p-[18px_18px_14px] shadow-card">
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          type="text"
          placeholder="Search products..."
          defaultValue={filters.q ?? ""}
          onChange={(e) => onFiltersChange({ ...filters, q: e.target.value || undefined, page: 1 })}
          className="h-[38px] w-[200px] rounded-inner border border-border bg-surface px-3 text-[0.76rem] text-text outline-none focus:border-brand-500"
        />
        <Link
          href="/products/marketing-review"
          className="ml-auto inline-flex h-[38px] items-center rounded-inner border border-border px-3 text-[0.78rem] font-bold text-text hover:bg-surface-2"
        >
          Marketing Review Cards
        </Link>
        <Link
          href="/products/new"
          className="inline-flex h-[38px] items-center gap-1.5 rounded-inner bg-brand-500 px-[15px] text-[0.8rem] font-bold text-white hover:bg-brand-600"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Product
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <input type="checkbox" checked={products.length > 0 && selected.size === products.length} onChange={toggleAll} className="h-4 w-4 accent-brand-500" />
        <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} className="h-[38px] min-w-[130px] rounded-inner border border-border bg-surface px-2.5 text-[0.75rem] font-semibold text-secondary outline-none">
          <option value="">Bulk Actions</option>
          <option value="activate">Set Active</option>
          <option value="draft">Set Draft</option>
          <option value="delete">Delete</option>
        </select>
        {bulkAction && selected.size > 0 && (
          <button type="button" onClick={applyBulkAction} className="h-[38px] rounded-inner bg-brand-500 px-3 text-[0.76rem] font-bold text-white hover:bg-brand-600">
            Apply ({selected.size})
          </button>
        )}
        <div className="flex-1" />
        <a href={exportHref()} className="inline-flex h-[38px] items-center gap-1.5 rounded-inner border border-border px-3 text-[0.78rem] font-bold text-text hover:bg-surface-2">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export
        </a>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="w-[34px] rounded-l-[8px] bg-[#f7f9fc] px-2.5 py-[11px]">
                <input type="checkbox" checked={products.length > 0 && selected.size === products.length} onChange={toggleAll} className="h-4 w-4 accent-brand-500" />
              </th>
              {["Product", "SKU", "Category", "Stock", "Price", "Status", "SEO Score", "Created At"].map((h) => (
                <th key={h} className="whitespace-nowrap bg-[#f7f9fc] px-2.5 py-[11px] text-left text-[0.73rem] font-bold text-secondary">
                  {h}
                </th>
              ))}
              <th className="rounded-r-[8px] bg-[#f7f9fc] px-2.5 py-[11px] text-left text-[0.73rem] font-bold text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={10} className="px-2.5 py-8 text-center text-sm text-muted">
                  No products match these filters.
                </td>
              </tr>
            )}
            {products.map((p) => {
              const name = p.translations[0]?.name ?? p.slug;
              const thumb = p.media.find((m) => m.isPrimary) ?? p.media[0];
              const categoryLabel = p.categoryIds.map((id) => categoryName.get(id)).filter(Boolean)[0] ?? "—";
              // Variant products carry no meaningful stock/price on the parent row itself
              // (those live per-variant) — show the real aggregate instead of the
              // always-zero parent fields, which is what produced the confusing
              // "0 stock, yet In Stock" pill combination.
              const variantStock = p.hasVariants ? p.variants.reduce((sum, v) => sum + v.stock, 0) : p.stock;
              const displayPrice = p.hasVariants ? (p.variants.find((v) => v.isDefault) ?? p.variants[0])?.price : p.price;
              const isExpanded = expanded.has(p.id);
              return (
                <Fragment key={p.id}>
                  <tr className="border-b border-[#f1f5fa] last:border-b-0 hover:bg-[#fafcfe]">
                    <td className="px-2.5 py-3.5 align-middle">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} className="h-4 w-4 accent-brand-500" />
                    </td>
                    <td className="px-2.5 py-3.5 align-middle">
                      <div className="flex min-w-[190px] items-center gap-2">
                        {p.hasVariants && (
                          <button
                            type="button"
                            onClick={() => toggleExpanded(p.id)}
                            aria-label={isExpanded ? "Hide variants" : "Show variants"}
                            className="grid h-5 w-5 flex-none place-items-center rounded-[6px] text-muted hover:bg-surface-2"
                          >
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={isExpanded ? "rotate-90" : ""}>
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </button>
                        )}
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb.url} alt="" className="h-[46px] w-[46px] flex-none rounded-[9px] border border-border object-cover" />
                        ) : (
                          <div className="grid h-[46px] w-[46px] flex-none place-items-center rounded-[9px] border border-border bg-surface-2 text-lg">📦</div>
                        )}
                        <div className="min-w-0">
                          <span className="line-clamp-2 block max-w-[180px] font-bold text-text">{name}</span>
                          {p.hasVariants && <span className="text-[0.68rem] font-semibold text-brand-500">{p.variants.length} variants</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-2.5 py-3.5 align-middle whitespace-nowrap text-[0.78rem] font-semibold text-text">{p.sku ?? "—"}</td>
                    <td className="px-2.5 py-3.5 align-middle whitespace-nowrap text-[0.78rem] font-semibold text-text">{categoryLabel}</td>
                    <td className="px-2.5 py-3.5 align-middle whitespace-nowrap">
                      <div className="font-bold text-text">{variantStock}</div>
                      <Pill className={`mt-[5px] ${STOCK_PILL[p.stockStatus] ?? "bg-surface-2 text-secondary"}`}>{STOCK_LABEL[p.stockStatus] ?? p.stockStatus}</Pill>
                    </td>
                    <td className="px-2.5 py-3.5 align-middle whitespace-nowrap font-bold text-text">৳{displayPrice ?? "—"}</td>
                    <td className="px-2.5 py-3.5 align-middle whitespace-nowrap">
                      <Pill className={STATUS_PILL[p.status] ?? "bg-surface-2 text-secondary"}>{p.status === "PUBLISHED" ? "Active" : p.status}</Pill>
                    </td>
                    <td className="px-2.5 py-3.5 align-middle">
                      <SeoRing score={p.seoScore} />
                    </td>
                    <td className="px-2.5 py-3.5 align-middle whitespace-nowrap text-[0.78rem] font-semibold text-text">
                      {p.createdAt ? new Date(p.createdAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-2.5 py-3.5 align-middle">
                      <div className="flex items-center gap-1.5">
                        <Link href={`/products/${p.id}`} aria-label="Edit" className="grid h-[30px] w-[30px] place-items-center rounded-[8px] bg-brand-50 text-brand-500 hover:bg-brand-100">
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          </svg>
                        </Link>
                        <button
                          type="button"
                          aria-label="Delete"
                          onClick={() => confirm(`Delete "${name}"?`) && deleteProduct.mutate(p.id)}
                          className="grid h-[30px] w-[30px] place-items-center rounded-[8px] text-muted hover:bg-surface-2"
                        >
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && p.hasVariants && (
                    <tr key={`${p.id}-variants`} className="border-b border-[#f1f5fa] bg-surface-2">
                      <td />
                      <td colSpan={9} className="px-2.5 py-3">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr>
                              {["Variant SKU", "Stock", "Status", "Price", "Sale Price", "Default"].map((h) => (
                                <th key={h} className="px-2.5 py-1.5 text-left text-[0.68rem] font-bold text-muted">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {p.variants.map((v) => (
                              <tr key={v.id}>
                                <td className="px-2.5 py-1.5 text-[0.75rem] font-bold text-text">{v.sku ?? `Variant #${v.id}`}</td>
                                <td className="px-2.5 py-1.5 text-[0.75rem] font-semibold text-text">{v.stock}</td>
                                <td className="px-2.5 py-1.5">
                                  <Pill className={STOCK_PILL[v.stockStatus] ?? "bg-surface-2 text-secondary"}>{STOCK_LABEL[v.stockStatus] ?? v.stockStatus}</Pill>
                                </td>
                                <td className="px-2.5 py-1.5 text-[0.75rem] font-semibold text-text">৳{v.price ?? "—"}</td>
                                <td className="px-2.5 py-1.5 text-[0.75rem] font-semibold text-text">{v.salePrice ? `৳${v.salePrice}` : "—"}</td>
                                <td className="px-2.5 py-1.5 text-[0.75rem] font-semibold text-text">{v.isDefault ? "Yes" : ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3.5">
        <div className="text-[0.76rem] font-semibold text-secondary">
          {total === 0 ? "No products" : `Showing ${start} to ${end} of ${total} products`}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onFiltersChange({ ...filters, page: page - 1 })}
            className="grid h-[30px] w-[30px] place-items-center rounded-[8px] border border-border text-text disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
            .reduce<number[]>((acc, n) => {
              if (acc.length && n - acc[acc.length - 1] > 1) acc.push(-1);
              acc.push(n);
              return acc;
            }, [])
            .map((n, i) =>
              n === -1 ? (
                <span key={`dots-${i}`} className="px-1 text-[0.74rem] text-muted">
                  …
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  onClick={() => onFiltersChange({ ...filters, page: n })}
                  className={`h-[30px] min-w-[30px] rounded-[8px] border px-2 text-[0.74rem] font-bold ${
                    n === page ? "border-brand-500 bg-brand-500 text-white" : "border-border text-text hover:bg-surface-2"
                  }`}
                >
                  {n}
                </button>
              ),
            )}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onFiltersChange({ ...filters, page: page + 1 })}
            className="grid h-[30px] w-[30px] place-items-center rounded-[8px] border border-border text-text disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <select
            value={pageSize}
            onChange={(e) => onFiltersChange({ ...filters, pageSize: Number(e.target.value), page: 1 })}
            className="h-[30px] rounded-[8px] border border-border bg-surface px-2 text-[0.72rem] font-semibold text-secondary outline-none"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} / page
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
