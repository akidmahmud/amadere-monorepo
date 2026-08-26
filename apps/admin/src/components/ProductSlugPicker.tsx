"use client";

import { useState } from "react";
import { useProducts } from "@/hooks/useProducts";

/**
 * Picks a product for a builder block, storing its SLUG.
 *
 * Slug rather than id because the storefront resolves the product through the
 * public `/products/{slug}` endpoint — an id would need an admin-only lookup
 * the storefront has no business making.
 *
 * The block stores only the reference. Packs, prices and stock are read live
 * from that product at render time, so editing a price in Products updates
 * every landing page using it. Copying the numbers into the block instead
 * would leave a page quoting a price the shop no longer charges.
 */
export function ProductSlugPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (slug: string) => void;
}) {
  const [q, setQ] = useState("");
  const { data, isLoading } = useProducts({ q: q.trim() || undefined, pageSize: 30 });
  const products = data?.items ?? [];

  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div className="flex items-center gap-2 rounded-sm border border-border bg-surface px-3 py-2 text-sm">
          <span className="truncate font-medium">{value}</span>
          <button
            type="button"
            onClick={() => onChange("")}
            className="ml-auto text-xs text-secondary underline"
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products…"
            className="h-9 rounded-sm border border-border bg-surface px-2.5 text-sm outline-none focus:border-brand-500"
          />
          <div className="max-h-56 overflow-y-auto rounded-sm border border-border">
            {isLoading ? (
              <p className="p-3 text-xs text-secondary">Loading…</p>
            ) : products.length === 0 ? (
              <p className="p-3 text-xs text-secondary">No products match.</p>
            ) : (
              products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onChange(p.slug)}
                  className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-brand-50"
                >
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {/* Price shown so the author can tell near-identical
                      products apart without leaving the builder. */}
                  {p.price && (
                    <span className="shrink-0 text-xs text-secondary">৳{p.price}</span>
                  )}
                  {p.hasVariants && (
                    <span className="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-600">
                      packs
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
