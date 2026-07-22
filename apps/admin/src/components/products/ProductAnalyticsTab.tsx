"use client";

import { useProductSalesStats } from "@/hooks/useProducts";

// Real sales figures only — this codebase has no page-view/conversion
// tracking for products, so unlike the reference mockup's fuller analytics
// panel, this only shows what we actually have rather than inventing charts.
export function ProductAnalyticsTab({ productId }: { productId: number }) {
  const { data, isLoading } = useProductSalesStats(productId);

  return (
    <div className="rounded-card border border-border bg-surface p-[18px]">
      <h3 className="mb-1 text-[0.9rem] font-extrabold text-text">Analytics</h3>
      <p className="mb-3.5 text-xs text-muted">
        Real sales figures only — this store doesn&apos;t track page views or conversion rate per product yet.
      </p>
      {isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-inner border border-border p-3.5">
            <div className="text-[0.72rem] font-semibold text-secondary">Units Sold</div>
            <div className="mt-1.5 text-xl font-extrabold text-text">{data?.unitsSold ?? 0}</div>
          </div>
          <div className="rounded-inner border border-border p-3.5">
            <div className="text-[0.72rem] font-semibold text-secondary">Revenue</div>
            <div className="mt-1.5 text-xl font-extrabold text-text">৳{Number(data?.revenue ?? 0).toLocaleString()}</div>
          </div>
          <div className="rounded-inner border border-border p-3.5">
            <div className="text-[0.72rem] font-semibold text-secondary">Orders</div>
            <div className="mt-1.5 text-xl font-extrabold text-text">{data?.orderCount ?? 0}</div>
          </div>
        </div>
      )}
    </div>
  );
}
