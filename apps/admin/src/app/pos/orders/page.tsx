"use client";

import { useState } from "react";
import { usePosContext } from "@/components/pos/PosContext";
import { PosSubPage } from "@/components/pos/PosSubPage";
import { PosOrdersManager } from "@/components/pos/PosOrdersManager";
import { StatCards } from "@/components/pos/ProductGrid";
import { usePosStats } from "@/hooks/usePos";

/** This shop's orders only; every store's are under Point of Sale › Order Manager. */
export default function PosOrdersPage() {
  const { storeId, can, store } = usePosContext();
  const { data: stats } = usePosStats(storeId);
  // "Orders" from the Customer Manager arrives with ?q=<phone>.
  const [initialQuery] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("q") ?? ""),
  );
  return (
    <PosSubPage title="Order Manager" permission="pos.orders" wide>
      {storeId && (
        <div className="mb-5">
          {/* Today's sales lives in the Order Manager's own card, which
              follows the payment / date filters. */}
          <StatCards kind="sales" stats={stats} omit={["Today's Sales"]} />
        </div>
      )}
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
