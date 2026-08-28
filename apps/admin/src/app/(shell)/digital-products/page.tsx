"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@amader/admin-ui";
import { useDigitalProducts } from "@/hooks/useDigitalProducts";
import { useDeleteProduct } from "@/hooks/useProducts";
import { useToast } from "@/components/ToastProvider";
import { ProxyApiError } from "@/lib/api/proxy-client";
import { friendlyErrorMessage } from "@/lib/friendly-error";

const GREEN = "#2e7d43";
const GREEN_HEADER = "#2f7d33";
const LINE = "#e5ebe6";
const INK = "#1e2b22";
const MUTED = "#64766b";
const TEXT = "#374840";
const FAINT = "#94a69a";

const STATUS_FILTERS = [
  { value: "ALL", label: "All Products" },
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING", label: "Pending" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

function StatCard({ label, value, icon, bgColor = "#e8f4ea", color = GREEN, borderColor = "#dff0e2" }: { label: string; value: string; icon: React.ReactNode; bgColor?: string; color?: string; borderColor?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-card border p-[15px_17px] shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
      <div>
        <div className="text-[0.72rem] font-semibold" style={{ color: MUTED }}>
          {label}
        </div>
        <div className="mt-1 text-[1.25rem] font-extrabold tracking-tight" style={{ color: INK }}>
          {value}
        </div>
      </div>
      <div className="grid h-10 w-10 flex-none place-items-center rounded-full border" style={{ background: bgColor, color, borderColor }}>
        {icon}
      </div>
    </div>
  );
}

const TH = ({ children, sticky, style }: { children: React.ReactNode; sticky?: 1 | 2; style?: React.CSSProperties }) => (
  <th
    className="sticky top-0 z-[5] px-3 py-3 text-left text-[0.72rem] font-bold whitespace-nowrap text-white"
    style={{
      background: GREEN_HEADER,
      borderRight: "1px solid rgba(255,255,255,.13)",
      ...(sticky === 1 ? { position: "sticky", left: 0, zIndex: 7, width: 42, minWidth: 42 } : {}),
      ...(sticky === 2 ? { position: "sticky", left: 42, zIndex: 7 } : {}),
      ...style,
    }}
  >
    {children}
  </th>
);

export default function DigitalProductsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const deleteProduct = useDeleteProduct();
  const toast = useToast();
  const { data, isLoading } = useDigitalProducts(page, pageSize, q || undefined);

  const rawItems = data?.items ?? [];
  const total = data?.total ?? 0;

  const items = statusFilter === "ALL" ? rawItems : rawItems.filter((i) => i.status === statusFilter);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const publishedCount = rawItems.filter((i) => i.status === "PUBLISHED").length;
  const draftCount = rawItems.filter((i) => i.status === "DRAFT").length;
  const pendingCount = rawItems.filter((i) => i.status === "PENDING" || i.status === "ARCHIVED").length;

  function handleDelete(id: number, name: string) {
    if (!confirm(`Delete digital product "${name}"?`)) return;
    deleteProduct.mutate(id, {
      onError: (err) => toast.push(err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Failed to delete product"),
    });
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))));
  }

  const td = "px-3 py-[11px] text-[0.76rem] font-semibold whitespace-nowrap align-middle border-b";
  const tdStyle = { color: TEXT, borderColor: "#eef3ef", background: "#fff" } as const;

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Top Header matching Order Manager */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.45rem] font-extrabold tracking-tight" style={{ color: INK }}>
            Digital Products
          </h1>
          <div className="mt-1.5 flex items-center gap-1.5 text-[0.76rem] font-semibold" style={{ color: MUTED }}>
            Dashboard <span style={{ color: "#94a69a" }}>›</span> Products <span style={{ color: "#94a69a" }}>›</span>{" "}
            <span style={{ color: GREEN }}>Digital Products</span>
          </div>
        </div>
        <Link href="/digital-products/new">
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-[10px] px-4 text-[0.8rem] font-bold text-white shadow-sm transition-transform hover:-translate-y-0.5"
            style={{ background: GREEN }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Digital Product
          </button>
        </Link>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Digital Products" value={String(total)} icon={<Icon name="inventory_2" />} bgColor="#e6f4ff" color="#0c8ce9" borderColor="#cce7ff" />
        <StatCard label="Published" value={String(publishedCount)} icon={<Icon name="check_circle" />} bgColor="#e8f4ea" color={GREEN} borderColor="#dff0e2" />
        <StatCard label="Drafts" value={String(draftCount)} icon={<Icon name="edit" />} bgColor="#f1eafe" color="#8b5cf6" borderColor="#e4d4fe" />
        <StatCard label="Pending / Archived" value={String(pendingCount)} icon={<Icon name="schedule" />} bgColor="#fff8e6" color="#d97706" borderColor="#feeed0" />
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border p-[14px_16px] shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
        <div className="relative w-72">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search digital products by name or SKU..."
            className="h-[38px] w-full rounded-[9px] border py-0 pr-[34px] pl-3 text-[0.76rem] outline-none hover:border-[#2e7d43] focus:border-[#2e7d43]"
            style={{ borderColor: LINE, color: TEXT }}
          />
          <svg className="pointer-events-none absolute top-1/2 right-[11px] -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={FAINT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>

        <div className="flex items-center gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className="rounded-pill px-3 py-1 text-[0.74rem] font-bold transition-all"
              style={
                statusFilter === f.value
                  ? { background: GREEN, color: "#fff" }
                  : { background: "#f2f6f3", color: MUTED }
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sticky Green Header Digital Products Table */}
      <div className="overflow-hidden rounded-card border shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
        <div className="overflow-auto" style={{ maxHeight: "62vh" }}>
          <table className="border-separate border-spacing-0" style={{ minWidth: 900, width: "100%" }}>
            <thead>
              <tr>
                <TH sticky={1}>
                  <input type="checkbox" checked={items.length > 0 && selected.size === items.length} onChange={toggleAll} className="h-[15px] w-[15px]" style={{ accentColor: GREEN }} />
                </TH>
                <TH sticky={2} style={{ minWidth: 260 }}>
                  Digital Product
                </TH>
                <TH>SKU</TH>
                <TH>Price</TH>
                <TH>Status</TH>
                <TH style={{ textAlign: "right" }}>Actions</TH>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm" style={{ color: FAINT }}>
                    Loading digital products…
                  </td>
                </tr>
              )}
              {!isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm" style={{ color: FAINT }}>
                    No digital products match these filters.
                  </td>
                </tr>
              )}
              {!isLoading &&
                items.map((product) => {
                  const isSelected = selected.has(product.id);
                  return (
                    <tr key={product.id} className="[&:hover>td]:bg-[#f7fbf8]">
                      <td className={td} style={{ ...tdStyle, position: "sticky", left: 0, zIndex: 6 }}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggle(product.id)} className="h-[15px] w-[15px]" style={{ accentColor: GREEN }} />
                      </td>
                      <td className={td} style={{ ...tdStyle, position: "sticky", left: 42, zIndex: 6, boxShadow: "6px 0 8px -6px rgba(20,40,25,.14)" }}>
                        <div className="flex items-center gap-3">
                          {product.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.thumbnailUrl} alt="" className="h-9 w-9 rounded-inner border border-border object-cover shrink-0" />
                          ) : (
                            <span className="grid h-9 w-9 place-items-center rounded-inner bg-surface-2 text-[10px] text-muted shrink-0">—</span>
                          )}
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="font-bold text-[#2e7d43] truncate">{product.name}</span>
                            <span className="text-[0.68rem] text-secondary truncate">{product.slug}</span>
                          </div>
                        </div>
                      </td>
                      <td className={td} style={{ ...tdStyle, color: MUTED }}>
                        {product.sku ?? "—"}
                      </td>
                      <td className={td} style={{ ...tdStyle, fontWeight: 700, color: INK }}>
                        {product.price !== undefined ? `৳${Number(product.price).toLocaleString()}` : "—"}
                      </td>
                      <td className={td} style={tdStyle}>
                        <span
                          className={`inline-block rounded-pill px-2.5 py-0.5 text-[0.68rem] font-bold ${
                            product.status === "PUBLISHED"
                              ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-400"
                              : product.status === "DRAFT"
                                ? "bg-purple-500/15 text-purple-700 dark:text-purple-400"
                                : product.status === "PENDING"
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                  : "bg-slate-500/15 text-slate-700 dark:text-slate-400"
                          }`}
                        >
                          {product.status}
                        </span>
                      </td>
                      <td className={td} style={{ ...tdStyle, textAlign: "right" }}>
                        <div className="flex justify-end items-center gap-2">
                          <Link href={`/digital-products/${product.id}`}>
                            <button
                              type="button"
                              className="inline-flex h-8 items-center rounded-[8px] border px-3 text-[0.72rem] font-bold transition-colors hover:bg-surface-2"
                              style={{ borderColor: LINE, color: TEXT }}
                            >
                              Edit
                            </button>
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(product.id, product.name)}
                            className="grid h-8 w-8 place-items-center rounded-[8px] border text-[#e5484d] transition-colors duration-150 hover:bg-[#e5484d] hover:text-white"
                            style={{ borderColor: "#f8ccd3" }}
                            title="Delete digital product"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" />
                              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Numbered Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3.5 border-t p-[13px_18px]" style={{ borderColor: LINE }}>
          <div className="text-[0.76rem] font-semibold" style={{ color: MUTED }}>
            {total === 0 ? "No digital products" : `Showing ${start} to ${end} of ${total} digital products`}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="grid h-[30px] w-[30px] place-items-center rounded-[8px] border disabled:opacity-40"
              style={{ borderColor: LINE, color: TEXT }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
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
                  <span key={`dots-${i}`} className="px-1 text-[0.74rem]" style={{ color: FAINT }}>
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className="h-[30px] min-w-[30px] rounded-[8px] border px-2 text-[0.74rem] font-bold"
                    style={n === page ? { background: GREEN, borderColor: GREEN, color: "#fff" } : { borderColor: LINE, color: TEXT }}
                  >
                    {n}
                  </button>
                ),
              )}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="grid h-[30px] w-[30px] place-items-center rounded-[8px] border disabled:opacity-40"
              style={{ borderColor: LINE, color: TEXT }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="h-[30px] rounded-[8px] border bg-white px-2 text-[0.72rem] font-semibold outline-none"
              style={{ borderColor: LINE, color: MUTED }}
            >
              {[20, 50, 100].map((s) => (
                <option key={s} value={s}>
                  {s} / page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
