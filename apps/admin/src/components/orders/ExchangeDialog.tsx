"use client";

import { useState } from "react";
import { Modal } from "@amader/admin-ui";
import { useCreateExchange, type AdminOrder } from "@/hooks/useOrders";

/**
 * Send a free replacement for damaged items: creates a new ৳0 order linked
 * to this one (Steadfast COD ৳0 unless staff later add a charge).
 */
export function ExchangeDialog({
  order,
  onClose,
  onCreated,
}: {
  order: AdminOrder;
  onClose: () => void;
  /** Called with the new exchange order, e.g. to open it. */
  onCreated: (orderId: number) => void;
}) {
  const create = useCreateExchange(order.id);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [reason, setReason] = useState("");
  const items = order.items.filter((i) => i.productId !== null);
  const chosen = Object.entries(picked).map(([itemId, quantity]) => ({
    itemId: Number(itemId),
    quantity,
  }));

  return (
    <Modal open onClose={onClose} title={`Exchange — ${order.orderNumber}`}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Tick the items to replace. A new order is made at ৳0 with ৳0 delivery
          for the same customer, linked to this one.
        </p>
        <div className="flex flex-col divide-y divide-border rounded-md border border-border">
          {items.map((i) => {
            const on = picked[i.id] !== undefined;
            return (
              <label
                key={i.id}
                className="flex items-center gap-3 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) =>
                    setPicked((p) => {
                      const next = { ...p };
                      if (e.target.checked) next[i.id] = i.quantity;
                      else delete next[i.id];
                      return next;
                    })
                  }
                />
                <span className="flex-1">{i.name}</span>
                <input
                  type="number"
                  min={1}
                  max={i.quantity}
                  disabled={!on}
                  value={on ? picked[i.id] : i.quantity}
                  onChange={(e) =>
                    setPicked((p) => ({
                      ...p,
                      [i.id]: Math.min(
                        i.quantity,
                        Math.max(1, Math.floor(Number(e.target.value)) || 1),
                      ),
                    }))
                  }
                  className="h-8 w-16 rounded-sm border border-border px-2 text-right disabled:opacity-40"
                  aria-label={`Quantity of ${i.name} to replace`}
                />
                <span className="w-12 text-xs text-muted">of {i.quantity}</span>
              </label>
            );
          })}
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-semibold text-muted">
            Reason (optional)
          </span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. turmeric smelled bad"
            className="h-9 rounded-sm border border-border px-2"
          />
        </label>
        {create.isError && (
          <p className="text-sm font-semibold text-danger">
            {(create.error as Error).message}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-md border border-border px-4 text-sm font-bold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={chosen.length === 0 || create.isPending}
            onClick={() =>
              create.mutate(
                { items: chosen, reason: reason.trim() || undefined },
                { onSuccess: (o) => onCreated(o.id) },
              )
            }
            className="h-10 rounded-md bg-[#2e7d43] px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {create.isPending ? "Creating…" : "Create exchange (৳0)"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
