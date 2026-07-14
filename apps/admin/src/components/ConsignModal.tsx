"use client";

import { useState } from "react";
import { Button, Modal } from "@amader/admin-ui";
import { useDispatchShipment, type ShipmentProvider } from "@/hooks/useShipments";
import {
  usePathaoAreas,
  usePathaoCities,
  usePathaoStores,
  usePathaoZones,
  useRedxAreas,
  useRedxPickupStores,
} from "@/hooks/useCourierSettings";

// Shared by the Order Manager list and the order detail modal — courier
// consign needs the Pathao/RedX location cascades either way.
export function ConsignModal({
  order,
  onClose,
  defaultProvider = "STEADFAST",
}: {
  order: { id: number; orderNumber: string };
  onClose: () => void;
  defaultProvider?: ShipmentProvider;
}) {
  const [provider, setProvider] = useState<ShipmentProvider>(defaultProvider);
  const dispatch = useDispatchShipment();
  const [error, setError] = useState<string | null>(null);

  const { data: pathaoStores } = usePathaoStores();
  const { data: pathaoCities } = usePathaoCities();
  const [pathaoCity, setPathaoCity] = useState<number | undefined>();
  const { data: pathaoZones } = usePathaoZones(pathaoCity);
  const [pathaoZone, setPathaoZone] = useState<number | undefined>();
  const { data: pathaoAreas } = usePathaoAreas(pathaoZone);
  const [pathaoArea, setPathaoArea] = useState<number | undefined>();
  const [pathaoStore, setPathaoStore] = useState<number | undefined>();

  const { data: redxAreas } = useRedxAreas();
  const [redxArea, setRedxArea] = useState<number | undefined>();
  const { data: redxStores } = useRedxPickupStores();
  const [redxStore, setRedxStore] = useState<number | undefined>();

  function submit() {
    setError(null);
    dispatch.mutate(
      {
        orderId: order.id,
        provider,
        pathao: provider === "PATHAO" && pathaoStore ? { storeId: pathaoStore, recipientCity: pathaoCity, recipientZone: pathaoZone, recipientArea: pathaoArea } : undefined,
        redx: provider === "REDX" && redxArea ? { deliveryAreaId: redxArea, pickupStoreId: redxStore } : undefined,
      },
      { onSuccess: onClose, onError: (e) => setError(e instanceof Error ? e.message : "Consign failed") },
    );
  }

  return (
    <Modal open onClose={onClose} title={`Send #${order.orderNumber} to courier`} tone="dark">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Courier</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as ShipmentProvider)}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          >
            <option value="STEADFAST">Steadfast</option>
            <option value="PATHAO">Pathao</option>
            <option value="REDX">RedX</option>
          </select>
        </label>

        {provider === "PATHAO" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Store</span>
              <select value={pathaoStore ?? ""} onChange={(e) => setPathaoStore(Number(e.target.value) || undefined)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none">
                <option value="">Select store…</option>
                {pathaoStores?.map((s) => <option key={s.store_id} value={s.store_id}>{s.store_name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">City</span>
              <select value={pathaoCity ?? ""} onChange={(e) => { setPathaoCity(Number(e.target.value) || undefined); setPathaoZone(undefined); setPathaoArea(undefined); }} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none">
                <option value="">Select city…</option>
                {pathaoCities?.map((c) => <option key={c.city_id} value={c.city_id}>{c.city_name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Zone</span>
              <select value={pathaoZone ?? ""} onChange={(e) => { setPathaoZone(Number(e.target.value) || undefined); setPathaoArea(undefined); }} disabled={!pathaoCity} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none disabled:opacity-50">
                <option value="">Select zone…</option>
                {pathaoZones?.map((z) => <option key={z.zone_id} value={z.zone_id}>{z.zone_name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Area</span>
              <select value={pathaoArea ?? ""} onChange={(e) => setPathaoArea(Number(e.target.value) || undefined)} disabled={!pathaoZone} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none disabled:opacity-50">
                <option value="">Select area…</option>
                {pathaoAreas?.map((a) => <option key={a.area_id} value={a.area_id}>{a.area_name}</option>)}
              </select>
            </label>
          </div>
        )}

        {provider === "REDX" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Delivery area</span>
              <select value={redxArea ?? ""} onChange={(e) => setRedxArea(Number(e.target.value) || undefined)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none">
                <option value="">Select area…</option>
                {redxAreas?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Pickup store</span>
              <select value={redxStore ?? ""} onChange={(e) => setRedxStore(Number(e.target.value) || undefined)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none">
                <option value="">Select pickup store…</option>
                {redxStores?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="primary" disabled={dispatch.isPending} onClick={submit}>
            {dispatch.isPending ? "Sending…" : "Send to courier"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
