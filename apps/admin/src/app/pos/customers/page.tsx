"use client";

import { usePosContext } from "@/components/pos/PosContext";
import { PosSubPage } from "@/components/pos/PosSubPage";
import { PosCustomersManager } from "@/components/pos/PosCustomersManager";

/** This shop's customers; every store's are under Point of Sale › Customers. */
export default function PosCustomersPage() {
  const { storeId, store, can } = usePosContext();
  return (
    <PosSubPage title="Customers" permission="pos.customers" wide>
      {storeId && (
        <PosCustomersManager
          key={storeId}
          storeId={storeId}
          storeName={store?.name}
          can={can}
          ordersHref={(phone) => `/pos/orders?q=${encodeURIComponent(phone)}`}
        />
      )}
    </PosSubPage>
  );
}
