"use client";

import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import { useAdminMe } from "@/hooks/useAdminAuth";
import type { ProductStatus } from "@/hooks/useProducts";

interface StoreOption {
  id: number;
  name: string;
  isOnlineStore: boolean;
}

/**
 * "Which store sells this?" — shared catalogue, or one store only. A
 * store-only product is always Admin only (the server enforces it; this just
 * keeps the form honest), which is what keeps it off amadere.com.
 */
export function ProductStoreField({
  value,
  onChange,
  onStatus,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  onStatus: (s: ProductStatus) => void;
}) {
  const { data: me } = useAdminMe();
  const can = (k: string) =>
    !!me && (me.isSuperAdmin || me.permissions.includes(k));
  const allStores = can("pos.all_stores");
  const visible = allStores || can("pos.store_products") || value !== null;
  const { data: stores = [] } = useQuery({
    queryKey: ["stores"],
    queryFn: () => proxyFetch<StoreOption[]>("/admin/stores"),
    enabled: visible,
  });
  if (!visible) return null;

  // A store manager may only pick their own store (or leave it shared if it already is).
  const options = allStores
    ? stores
    : stores.filter((s) => s.id === me?.storeId);

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-text">Sold at</span>
      <select
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value ? Number(e.target.value) : null;
          onChange(v);
          if (v !== null) onStatus("ADMIN_ONLY");
        }}
        className="h-10 rounded-lg border border-emerald-800/20 bg-white px-3 text-sm font-semibold text-emerald-950 outline-none focus:border-emerald-600"
      >
        <option value="">All stores (shared)</option>
        {options.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} only
          </option>
        ))}
      </select>
      {value !== null && (
        <span className="text-[11px] font-semibold text-amber-800">
          Store-only products are never shown on amadere.com.
        </span>
      )}
    </label>
  );
}
