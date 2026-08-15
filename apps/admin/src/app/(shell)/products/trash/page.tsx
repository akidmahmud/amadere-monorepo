"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminMe } from "@/hooks/useAdminAuth";
import { useDeletedProducts, useRestoreProduct } from "@/hooks/useProducts";
import { useToast } from "@/components/ToastProvider";
import { ProxyApiError } from "@/lib/api/proxy-client";
import { friendlyErrorMessage } from "@/lib/friendly-error";

const restoreIcon = (
  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </svg>
);
const lockIcon = (
  <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="10" width="16" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);
const emptyTrashIcon = (
  <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
);

// Days-remaining pill: green while there's plenty of runway, amber once
// it's getting close, red in the last 3 days — the same "don't bury an
// urgent countdown in plain text" idea as the SEO ring on the main list.
function DaysRemainingPill({ days }: { days: number }) {
  const style =
    days <= 3
      ? "bg-danger/10 text-danger"
      : days <= 10
        ? "bg-[#fdf1dc] text-[#e0821c]"
        : "bg-[#e3f7ee] text-[#16a06d]";
  return (
    <span className={`inline-flex items-center rounded-[6px] px-2.5 py-1 text-[0.7rem] font-bold ${style}`}>
      {days === 0 ? "Purging today" : `${days} day${days === 1 ? "" : "s"} left`}
    </span>
  );
}

const PAGE_SIZE = 20;

export default function DeletedProductsPage() {
  const { data: me, isLoading: meLoading } = useAdminMe();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const { data, isLoading } = useDeletedProducts(page, PAGE_SIZE, searchQuery);
  const restore = useRestoreProduct();
  const toast = useToast();
  const [restoringId, setRestoringId] = useState<number | null>(null);

  async function handleRestore(id: number, name: string) {
    setRestoringId(id);
    try {
      await restore.mutateAsync(id);
      toast.push(`"${name}" restored.`, "success");
    } catch (err) {
      toast.push(err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Failed to restore product");
    } finally {
      setRestoringId(null);
    }
  }

  if (meLoading) return <p className="text-sm text-muted">Loading…</p>;

  // Mirrors the backend's SuperAdminGuard on GET /admin/products/trash — a
  // regular admin who navigates here directly (the nav item itself isn't
  // permission-gated, matching every other nav entry in this app) sees a
  // clear explanation instead of a raw 403 from the failed query.
  if (!me?.isSuperAdmin) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface py-16 text-center shadow-card">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-surface-2 text-muted">{lockIcon}</span>
        <h2 className="font-ui text-base font-bold text-text">Super admin access required</h2>
        <p className="max-w-sm text-sm text-secondary">
          Deleted products can only be viewed and restored by a super admin. Ask one on your team if you need
          something recovered.
        </p>
      </div>
    );
  }

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-ui text-lg font-extrabold text-text">Deleted Products</h1>
          <p className="mt-0.5 text-sm text-secondary">
            Products deleted from the catalog stay here for 30 days before they're permanently removed.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search deleted products..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="h-[38px] w-[220px] rounded-inner border border-border bg-surface px-3 text-[0.76rem] text-text outline-none focus:border-brand-500"
          />
          <Link href="/products" className="text-sm font-semibold text-brand-500 hover:underline">
            ← Back to Products
          </Link>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}

      {!isLoading && (data?.items?.length ?? 0) === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface py-16 text-center shadow-card">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-surface-2 text-muted">{emptyTrashIcon}</span>
          <h2 className="font-ui text-base font-bold text-text">
            {searchQuery ? `No deleted products matching "${searchQuery}"` : "Trash is empty"}
          </h2>
          <p className="max-w-sm text-sm text-secondary">
            {searchQuery ? "Try refining your search query." : "Products you delete from the catalog will show up here."}
          </p>
        </div>
      )}

      {!isLoading && (data?.items?.length ?? 0) > 0 && (
        <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Product", "Deleted On", "Time Left", ""].map((h) => (
                  <th key={h} className="whitespace-nowrap bg-[#f7f9fc] px-4 py-[11px] text-left text-[0.73rem] font-bold text-secondary first:rounded-tl-card last:rounded-tr-card">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data!.items!.map((p) => (
                <tr key={p.id} className="border-b border-[#f1f5fa] last:border-b-0 hover:bg-[#fafcfe]">
                  <td className="px-4 py-3 align-middle">
                    <div className="flex min-w-[200px] items-center gap-2.5">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className="h-[42px] w-[42px] flex-none rounded-[9px] border border-border object-cover opacity-70" />
                      ) : (
                        <div className="grid h-[42px] w-[42px] flex-none place-items-center rounded-[9px] border border-border bg-surface-2 text-base">📦</div>
                      )}
                      <span className="line-clamp-2 max-w-[260px] font-bold text-text">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle whitespace-nowrap text-[0.78rem] font-semibold text-text">
                    {new Date(p.deletedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <DaysRemainingPill days={p.daysRemaining} />
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <button
                      type="button"
                      disabled={restoringId === p.id}
                      onClick={() => handleRestore(p.id, p.name)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-inner border border-brand-500 px-3 text-[0.76rem] font-bold text-brand-500 transition-colors duration-150 hover:bg-brand-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {restoreIcon}
                      {restoringId === p.id ? "Restoring…" : "Restore"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="grid h-[30px] w-[30px] place-items-center rounded-[8px] border border-border text-text disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="px-2 text-[0.76rem] font-semibold text-secondary">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="grid h-[30px] w-[30px] place-items-center rounded-[8px] border border-border text-text disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
