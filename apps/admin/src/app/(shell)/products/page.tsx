"use client";

import { useState } from "react";
import { useProducts, useProductStats, type AdminProductFilters } from "@/hooks/useProducts";
import { ProductStatsStrip } from "@/components/products/ProductStatsStrip";
import { ProductFilters } from "@/components/products/ProductFilters";
import { ProductsTable } from "@/components/products/ProductsTable";

const DEFAULT_FILTERS: AdminProductFilters = { page: 1, pageSize: 10 };

export default function ProductsPage() {
  const [filters, setFilters] = useState<AdminProductFilters>(DEFAULT_FILTERS);
  const { data: stats } = useProductStats();
  const { data } = useProducts(filters);

  return (
    <div className="flex flex-col gap-[18px]">
      <ProductStatsStrip stats={stats} />

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[210px_1fr] lg:items-start">
        <ProductFilters filters={filters} onChange={setFilters} onReset={() => setFilters(DEFAULT_FILTERS)} />
        {!data ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <ProductsTable products={data.items ?? []} total={data.total ?? 0} filters={filters} onFiltersChange={setFilters} />
        )}
      </div>
    </div>
  );
}
