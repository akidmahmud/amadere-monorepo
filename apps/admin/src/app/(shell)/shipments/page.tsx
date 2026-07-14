"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { SHIPMENT_PROVIDERS, useCancelShipment, useShipments, useTrackShipment, type ShipmentProvider } from "@/hooks/useShipments";

export default function ShipmentsPage() {
  const [provider, setProvider] = useState<ShipmentProvider | undefined>();
  const { data: shipments, isLoading } = useShipments(provider);
  const track = useTrackShipment();
  const cancel = useCancelShipment();

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{shipments?.length ?? 0} shipments</p>
        <select
          value={provider ?? ""}
          onChange={(e) => setProvider(e.target.value ? (e.target.value as ShipmentProvider) : undefined)}
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        >
          <option value="">All couriers</option>
          {SHIPMENT_PROVIDERS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {shipments && shipments.length === 0 && <p className="text-sm text-muted">No shipments.</p>}

      <div className="flex flex-col gap-3">
        {shipments?.map((s) => (
          <Card key={s.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-text">
                {String(s.provider)} · {s.trackingCode ?? "no tracking code yet"}
              </div>
              <div className="text-xs text-muted">
                {String(s.status)} ·{" "}
                <Link href={`/orders/${s.orderId}`} className="text-brand-500">
                  Order #{s.orderId}
                </Link>
                {s.cost && ` · ৳${s.cost}`}
              </div>
            </div>
            <Button type="button" variant="ghost" disabled={track.isPending} onClick={() => track.mutate(s.id)}>
              Refresh tracking
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={cancel.isPending}
              onClick={() => {
                const reasonCode = prompt("Cancellation reason (e.g. customer-requested):");
                if (reasonCode) cancel.mutate({ id: s.id, reasonCode });
              }}
            >
              Cancel
            </Button>
          </Card>
        ))}
      </div>
    </>
  );
}
