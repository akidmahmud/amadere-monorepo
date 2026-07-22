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
    <div className="rounded-card border border-border bg-surface p-[18px]">
      <h3 className="mb-1 text-[0.9rem] font-extrabold text-text">Activity Log</h3>
      <p className="mb-3.5 text-xs text-muted">
        Whole-product edits only — variant, cross-sell, and SKU/stock/price sub-edits aren&apos;t attributed to a specific product ID in the audit log yet.
      </p>
      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {!isLoading && (!data || data.items.length === 0) && <p className="text-sm text-muted">No recorded edits yet.</p>}
      <div className="flex flex-col">
        {data?.items.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between gap-3 border-b border-[#f1f5fa] py-2.5 last:border-b-0">
            <span className="font-mono text-[0.72rem] text-text">{entry.action}</span>
            <span className="whitespace-nowrap text-[0.72rem] font-semibold text-muted">
              {new Date(entry.createdAt).toLocaleString("en", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
