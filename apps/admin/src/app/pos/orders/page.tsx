"use client";

import { useState } from "react";
import { usePosContext } from "@/components/pos/PosContext";
import { PosSubPage } from "@/components/pos/PosSubPage";
import { PosOrdersManager } from "@/components/pos/PosOrdersManager";

/** This shop's orders only; every store's are under Point of Sale › Order Manager. */
export default function PosOrdersPage() {
  const { storeId, can, store } = usePosContext();
  // "Orders" from the Customer Manager arrives with ?q=<phone>.
  const [initialQuery] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("q") ?? ""),
  );
  return (
    <PosSubPage title="Order Manager" permission="pos.orders" wide>
      {storeId && (
        <PosOrdersManager
          key={storeId}
          storeId={storeId}
          storeName={store?.name}
          can={can}
          initialQuery={initialQuery}
        />
      )}
    </PosSubPage>
  );
}
