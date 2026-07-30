"use client";

import { Modal } from "@amader/admin-ui";
import { NewOrderForm } from "@/components/orders/NewOrderForm";
import type { AdminOrder } from "@/hooks/useOrders";

export interface NewOrderModalProps {
  open: boolean;
  onClose: () => void;
  /** Fires after the order is created and the modal has closed — use it to refresh whatever list is behind the modal. */
  onCreated?: (order: AdminOrder) => void;
}

// Same form as the standalone /orders/new page, embedded in a modal so
// staff can create an order without leaving the page they launched it from
// (e.g. Order Manager) — stays put rather than navigating to the new
// order's detail page, since the whole point is not losing the caller's
// place.
export function NewOrderModal({ open, onClose, onCreated }: NewOrderModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Create an order" tone="dark" className="max-w-[1300px]">
      <NewOrderForm
        onCreated={(order) => {
          onClose();
          onCreated?.(order);
        }}
        onCancel={onClose}
      />
    </Modal>
  );
}
