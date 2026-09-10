"use client";

import { useState } from "react";
import { Card, Icon, PageHeader, Tabs } from "@amader/admin-ui";
import { InvoiceSettingsForm } from "@/components/settings/InvoiceSettingsForm";
import {
  useWholesaleCustomers,
  type WholesaleCustomer,
  type WholesaleOrder,
} from "@/hooks/useWholesale";
import { CreateOrderPanel } from "./_components/CreateOrderPanel";
import { CustomerModal } from "./_components/CustomerModal";
import { CustomersDashboard } from "./_components/CustomersDashboard";
import { OrderModal } from "./_components/OrderModal";
import { OrdersDashboard } from "./_components/OrdersDashboard";
import { PaymentModal } from "./_components/PaymentModal";

type Screen = "create" | "orders" | "customers" | "invoice";

export default function WholesalePage() {
  const [screen, setScreen] = useState<Screen>("create");
  const [toast, setToast] = useState<string | null>(null);

  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] =
    useState<WholesaleCustomer | null>(null);

  const [paymentOrder, setPaymentOrder] = useState<WholesaleOrder | null>(null);
  const [editingOrder, setEditingOrder] = useState<WholesaleOrder | null>(null);

  // Every customer, unfiltered (pageSize 0) — the create screen searches this
  // list in the browser so picking a buyer stays instant while an order is
  // being typed.
  const customers = useWholesaleCustomers("", false, 1, 0);

  function announce(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }

  function openCustomerModal(c: WholesaleCustomer | null) {
    setEditingCustomer(c);
    setCustomerModalOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Wholesale & Cash Sale"
        subtitle="Bulk orders for shops and over-the-counter cash sales. Both raise a receivable and post to the Accounts ledger, and neither ever touches the retail Order Manager."
      />

      <Tabs
        options={[
          { value: "create", label: "Create Order" },
          { value: "orders", label: "Orders Dashboard" },
          { value: "customers", label: "Customer Dashboard" },
          { value: "invoice", label: "Invoice Settings" },
        ]}
        value={screen}
        onChange={(v) => setScreen(v as Screen)}
      />

      {/* Kept mounted, not unmounted per tab: a half-typed order must survive
          a glance at the dashboard. */}
      <div className={screen === "create" ? "" : "hidden"}>
        <CreateOrderPanel
          customers={customers.data?.items ?? []}
          onCreateCustomer={() => openCustomerModal(null)}
          onCreated={(orderNumber) => {
            announce(`${orderNumber} created`);
            setScreen("orders");
          }}
        />
      </div>

      {screen === "orders" && (
        <OrdersDashboard
          onCollectPayment={setPaymentOrder}
          onEditOrder={setEditingOrder}
        />
      )}

      {screen === "customers" && (
        <CustomersDashboard
          onNewCustomer={() => openCustomerModal(null)}
          onEditCustomer={openCustomerModal}
          onOrderFor={() => setScreen("create")}
        />
      )}

      {screen === "invoice" && (
        <div className="flex flex-col gap-4">
          <Card className="flex items-start gap-3 p-4 shadow-card">
            <Icon
              name="info"
              size={20}
              className="mt-0.5 flex-none text-brand-500"
            />
            <p className="text-xs leading-relaxed text-secondary">
              These are the <strong className="text-text">same</strong> settings
              as Settings → Invoices. A wholesale invoice and a retail one print
              from one template and one set of company details, so editing here
              changes both — that is deliberate, and it is what stops the two
              books printing two different companies.
            </p>
          </Card>
          <InvoiceSettingsForm />
        </div>
      )}

      {customerModalOpen && (
        <CustomerModal
          key={`customer-${editingCustomer?.id ?? "new"}`}
          open
          editing={editingCustomer}
          onClose={() => setCustomerModalOpen(false)}
          onSaved={(c) =>
            announce(editingCustomer ? `${c.name} updated` : `${c.name} created`)
          }
        />
      )}

      {editingOrder && (
        <OrderModal
          key={`order-edit-${editingOrder.id}`}
          open
          customers={customers.data?.items ?? []}
          presetCustomerId={editingOrder.partyId}
          editing={editingOrder}
          onClose={() => setEditingOrder(null)}
        />
      )}

      {paymentOrder && (
        <PaymentModal
          open
          order={paymentOrder}
          onClose={() => setPaymentOrder(null)}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-[200] rounded-xl bg-text px-4 py-3 text-xs font-semibold text-surface shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
