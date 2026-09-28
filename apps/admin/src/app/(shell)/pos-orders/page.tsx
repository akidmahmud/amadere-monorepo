"use client";

import { useState } from "react";
import { useAdminMe } from "@/hooks/useAdminAuth";
import { usePosStores } from "@/hooks/usePos";
import { PosOrdersManager } from "@/components/pos/PosOrdersManager";

/** Every store's till sales, with a store filter (the POS's own page shows one shop). */
export default function PosOrderManagerPage() {
  const { data: me } = useAdminMe();
  const can = (k: string) =>
    !!me && (me.isSuperAdmin || me.permissions.includes(k));
  const { data: stores = [] } = usePosStores(!!me);
  // "Orders" from the Customer Manager arrives with ?q=<phone>.
  const [initialQuery] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("q") ?? ""),
  );
  if (!me) return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  if (!can("pos.orders"))
    return (
      <div className="p-6 text-sm text-gray-600">
        You don&apos;t have permission for this page.
      </div>
    );
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-sm text-gray-500">
          Till sales from every store — filter by store, payment, date or
          customer.
        </p>
      </div>
      <PosOrdersManager
        stores={stores.map((s) => ({ id: s.id, name: s.name }))}
        can={can}
        initialQuery={initialQuery}
      />
    </div>
  );
}
