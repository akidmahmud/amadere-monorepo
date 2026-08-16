"use client";

import { useAuditLog } from "@/hooks/useAuditLog";

// Real data from the existing audit-log endpoint, scoped to this product —
// the AuditLogInterceptor only captures entityId on the top-level
// PATCH /admin/products/:id route, not nested variant/cross-sell routes
// (those log with a null entityId), so this only shows whole-product edits,
// not every sub-resource change. Flagged here rather than silently
// presented as complete.
export function ProductActivityTab({ productId }: { productId: number }) {
  const { data, isLoading } = useAuditLog({ entityType: "AdminProducts", entityId: productId });

  return (
    <div className="rounded-xl border border-emerald-800/20 bg-gradient-to-b from-white via-white to-emerald-50/20 p-6 shadow-sm">
      <h3 className="mb-1 text-[0.95rem] font-extrabold text-emerald-950 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-emerald-800/10 text-emerald-800">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </span>
        Activity History
      </h3>
      <p className="mb-5 text-xs font-semibold text-emerald-900/60">
        Whole-product edits only — variant, cross-sell, and SKU/stock/price sub-edits aren&apos;t attributed to a specific product ID in the audit log yet.
      </p>
      {isLoading && (
        <div className="flex items-center gap-2 py-4 text-xs font-bold text-emerald-900/60">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-800 border-t-transparent" />
          Loading activity timeline…
        </div>
      )}
      {!isLoading && (!data || data.items.length === 0) && (
        <div className="rounded-xl border border-emerald-800/15 bg-emerald-50/30 p-4 text-xs font-semibold text-emerald-900/70">
          No recorded edits yet for this product.
        </div>
      )}
      <div className="flex flex-col gap-2">
        {data?.items.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between gap-3 rounded-lg border border-emerald-800/15 bg-white p-3 shadow-xs transition-all hover:border-amber-400/40">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-emerald-600 shadow-[0_0_6px_rgba(5,150,105,0.6)]" />
              <span className="font-mono text-xs font-extrabold text-emerald-950">{entry.action}</span>
            </div>
            <span className="whitespace-nowrap rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-800 border border-amber-400/30">
              {new Date(entry.createdAt).toLocaleString("en", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
