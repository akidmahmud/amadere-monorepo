"use client";

import { useProductSalesStats } from "@/hooks/useProducts";

// Real sales figures only — this codebase has no page-view/conversion
// tracking for products, so unlike the reference mockup's fuller analytics
// panel, this only shows what we actually have rather than inventing charts.
export function ProductAnalyticsTab({ productId }: { productId: number }) {
  const { data, isLoading } = useProductSalesStats(productId);

  return (
    <div className="rounded-xl border border-emerald-800/20 bg-gradient-to-b from-white via-white to-emerald-50/20 p-6 shadow-sm">
      <h3 className="mb-1 text-[0.95rem] font-extrabold text-emerald-950 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-emerald-800/10 text-emerald-800">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        </span>
        Sales Analytics
      </h3>
      <p className="mb-5 text-xs font-semibold text-emerald-900/60">
        Real sales figures only — this store doesn&apos;t track page views or conversion rate per product yet.
      </p>
      {isLoading ? (
        <div className="flex items-center gap-2 py-4 text-xs font-bold text-emerald-900/60">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-800 border-t-transparent" />
          Loading performance statistics…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-800/20 bg-gradient-to-br from-emerald-50/60 via-white to-emerald-50/20 p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-900/70">
              <span>Units Sold</span>
              <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-800/10 text-emerald-800 text-[10px]">📦</span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-emerald-950">{data?.unitsSold ?? 0}</div>
          </div>
          <div className="rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-500/10 via-amber-400/15 to-emerald-900/5 p-4 shadow-sm ring-1 ring-amber-400/30">
            <div className="flex items-center justify-between text-xs font-extrabold text-amber-900">
              <span>Total Revenue</span>
              <span className="grid h-5 w-5 place-items-center rounded-full bg-amber-400/30 text-amber-800 text-[10px]">💰</span>
            </div>
            <div className="mt-2 text-2xl font-black text-amber-700">৳{Number(data?.revenue ?? 0).toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-emerald-800/20 bg-gradient-to-br from-emerald-50/60 via-white to-emerald-50/20 p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-900/70">
              <span>Completed Orders</span>
              <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-800/10 text-emerald-800 text-[10px]">📋</span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-emerald-950">{data?.orderCount ?? 0}</div>
          </div>
        </div>
      )}
    </div>
  );
}
