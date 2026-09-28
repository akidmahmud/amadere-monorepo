"use client";

import { useAdminMe } from "@/hooks/useAdminAuth";
import { usePosStores } from "@/hooks/usePos";
import { PosCustomersManager } from "@/components/pos/PosCustomersManager";

/** Customers who bought at any store, with a store filter. */
export default function PosCustomerManagerPage() {
  const { data: me } = useAdminMe();
  const can = (k: string) =>
    !!me && (me.isSuperAdmin || me.permissions.includes(k));
  const { data: stores = [] } = usePosStores(!!me);
  if (!me) return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  if (!can("pos.customers"))
    return (
      <div className="p-6 text-sm text-gray-600">
        You don&apos;t have permission for this page.
      </div>
    );
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-sm text-gray-500">
          Everyone who bought at your stores — filter by store or search.
        </p>
      </div>
      <PosCustomersManager
        stores={stores.map((s) => ({ id: s.id, name: s.name }))}
        ordersHref={(phone) => `/pos-orders?q=${encodeURIComponent(phone)}`}
        can={can}
      />
    </div>
  );
}
