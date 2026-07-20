"use client";

import Link from "next/link";
import { Button, Modal } from "@amader/admin-ui";
import { useCustomer } from "@/hooks/useCustomers";

// Quick-view for a row click in the customers list — full note/call-log/
// order-history/activity-timeline management still lives on the dedicated
// /customers/[id] page (too much surface for a modal); "Edit" hands off
// there, mirroring OrderDetailModal's own "detail modal + dedicated page
// for deep editing" split used elsewhere in this admin app.
export function CustomerDetailModal({ customerId, onClose }: { customerId: number; onClose: () => void }) {
  const { data: customer, isLoading } = useCustomer(customerId);

  return (
    <Modal open onClose={onClose} title={customer?.name ?? "Customer"} tone="dark" className="max-w-xl">
      {isLoading || !customer ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="text-sm text-text">
              <div>{customer.phone ?? "no phone"}</div>
              <div className="text-muted">{customer.email ?? "no email"}</div>
            </div>
            {customer.tier && (
              <span className="rounded-pill bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-500">{customer.tier}</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 border-y border-border py-4">
            <div>
              <p className="text-xs font-semibold text-secondary">Completed Orders</p>
              <p className="num text-lg font-bold text-text">{customer.completedOrderCount}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-secondary">Birthday</p>
              <p className="text-sm text-text">{customer.dob ? new Date(customer.dob).toLocaleDateString() : "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-secondary">Customer Since</p>
              <p className="text-sm text-text">{new Date(customer.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-secondary">Recent Orders</p>
            {customer.orders.length === 0 ? (
              <p className="text-sm text-muted">No orders yet.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {customer.orders.slice(0, 3).map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-sm text-text">
                    <span>{o.orderNumber}</span>
                    <span className="flex items-center gap-2">
                      <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-xs font-semibold text-secondary">{o.status}</span>
                      <span className="num">৳{o.totalAmount}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {customer.notes.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-secondary">Latest Note</p>
              <p className="text-sm text-text">{customer.notes[0].body}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <Link href={`/orders/new?customerId=${customerId}`}>
              <Button type="button" variant="ghost">
                New Order
              </Button>
            </Link>
            <Button type="button" variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Link href={`/customers/${customerId}`}>
              <Button type="button" variant="primary">
                Edit →
              </Button>
            </Link>
          </div>
        </div>
      )}
    </Modal>
  );
}
