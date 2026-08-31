"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Icon,
  PageHeader,
  StatCard,
  Tabs,
} from "@amader/admin-ui";
import {
  COURIERS,
  ORDER_STATUSES,
  downloadWholesaleOrdersCsv,
  useCancelWholesaleOrder,
  useUpdateWholesaleOrder,
  useDeleteWholesaleCustomer,
  useWholesaleCustomers,
  useWholesaleOrders,
  wholesaleInvoiceHref,
  type WholesaleCustomer,
  type WholesaleOrder,
  type WholesaleOrderStatus,
} from "@/hooks/useWholesale";
import { CustomerModal } from "./_components/CustomerModal";
import { OrderModal } from "./_components/OrderModal";
import { PaymentModal } from "./_components/PaymentModal";

const money = (v: string | number) =>
  `৳${Number(v).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const courierLabel = (v: string) =>
  COURIERS.find((c) => c.value === v)?.label ?? v;

const STATUS_TONE: Record<
  WholesaleOrderStatus,
  { badge: string; select: string }
> = {
  PENDING: {
    badge:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    select: "bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold",
  },
  PROCESSING: {
    badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    select: "bg-blue-500/10 text-blue-700 dark:text-blue-400 font-bold",
  },
  DELIVERED: {
    badge:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    select:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold",
  },
  CANCELLED: {
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    select: "bg-rose-500/10 text-rose-700 dark:text-rose-400 font-bold",
  },
};

const fieldClass =
  "h-10 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text transition-all duration-200 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 placeholder:text-muted";

export default function WholesalePage() {
  const [tab, setTab] = useState("orders");

  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatus, setOrderStatus] = useState("ALL");
  const [customerSearch, setCustomerSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);

  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderPreset, setOrderPreset] = useState<number | null>(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] =
    useState<WholesaleCustomer | null>(null);

  const [paymentOrder, setPaymentOrder] = useState<WholesaleOrder | null>(null);
  const [editingOrder, setEditingOrder] = useState<WholesaleOrder | null>(null);

  const orders = useWholesaleOrders(orderSearch, orderStatus);
  const customers = useWholesaleCustomers(customerSearch, activeOnly);
  const allCustomers = useWholesaleCustomers("", false);

  const stats = useMemo(() => {
    const live = (orders.data ?? []).filter((o) => o.status !== "CANCELLED");
    const sum = (pick: (o: WholesaleOrder) => string) =>
      live.reduce((total, o) => total + Number(pick(o)), 0);
    return {
      orders: live.length,
      customers: allCustomers.data?.length ?? 0,
      sales: sum((o) => o.total),
      collected: sum((o) => o.paid),
      due: sum((o) => o.due),
    };
  }, [orders.data, allCustomers.data]);

  function openNewOrder(customerId: number | null) {
    setOrderPreset(customerId);
    setOrderModalOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Wholesale Manager"
        subtitle="Bulk B2B orders and shop buyers — managed independently from retail transactions with automatic accounts ledger sync."
        actions={
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-white/15 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/25 active:scale-95"
              onClick={() => {
                setEditingCustomer(null);
                setCustomerModalOpen(true);
              }}
            >
              <Icon name="person_add" size={18} />
              Add Customer
            </button>
            <Button variant="primary" onClick={() => openNewOrder(null)}>
              <Icon name="add" size={18} />
              New Order
            </Button>
          </div>
        }
      />

      {/* KPI Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Wholesale Customers"
          value={String(stats.customers)}
          icon={<Icon name="store" size={24} className="text-brand-500" />}
        />
        <StatCard
          label="Active Wholesale Orders"
          value={String(stats.orders)}
          icon={
            <Icon name="local_shipping" size={24} className="text-blue-500" />
          }
        />
        <StatCard
          label="Total Wholesale Sales"
          value={money(stats.sales)}
          footer={`${money(stats.collected)} collected to Accounts`}
          icon={<Icon name="payments" size={24} className="text-emerald-500" />}
        />
        <StatCard
          label="Outstanding Receivables"
          value={money(stats.due)}
          icon={
            <Icon
              name="account_balance_wallet"
              size={24}
              className="text-amber-500"
            />
          }
        />
      </div>

      <Tabs
        options={[
          { value: "orders", label: `Orders (${orders.data?.length ?? 0})` },
          {
            value: "customers",
            label: `Customers (${customers.data?.length ?? 0})`,
          },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "orders" ? (
        <OrdersTab
          orders={orders.data ?? []}
          loading={orders.isLoading}
          error={orders.error}
          search={orderSearch}
          onSearch={setOrderSearch}
          status={orderStatus}
          onStatus={setOrderStatus}
          onNew={() => openNewOrder(null)}
          onCollectPayment={(order) => setPaymentOrder(order)}
          onEditOrder={(order) => setEditingOrder(order)}
        />
      ) : (
        <CustomersTab
          customers={customers.data ?? []}
          loading={customers.isLoading}
          error={customers.error}
          search={customerSearch}
          onSearch={setCustomerSearch}
          activeOnly={activeOnly}
          onActiveOnly={setActiveOnly}
          onNew={() => {
            setEditingCustomer(null);
            setCustomerModalOpen(true);
          }}
          onEdit={(c) => {
            setEditingCustomer(c);
            setCustomerModalOpen(true);
          }}
          onOrder={(c) => openNewOrder(c.id)}
        />
      )}

      {orderModalOpen && (
        <OrderModal
          key={`order-${orderPreset ?? "new"}`}
          open
          customers={allCustomers.data ?? []}
          presetCustomerId={orderPreset}
          onClose={() => setOrderModalOpen(false)}
        />
      )}

      {editingOrder && (
        <OrderModal
          key={`order-edit-${editingOrder.id}`}
          open
          customers={allCustomers.data ?? []}
          presetCustomerId={editingOrder.partyId}
          editing={editingOrder}
          onClose={() => setEditingOrder(null)}
        />
      )}

      {customerModalOpen && (
        <CustomerModal
          key={`customer-${editingCustomer?.id ?? "new"}`}
          open
          editing={editingCustomer}
          onClose={() => setCustomerModalOpen(false)}
        />
      )}

      {paymentOrder && (
        <PaymentModal
          open={!!paymentOrder}
          order={paymentOrder}
          onClose={() => setPaymentOrder(null)}
        />
      )}
    </div>
  );
}

function OrdersTab({
  orders,
  loading,
  error,
  search,
  onSearch,
  status,
  onStatus,
  onNew,
  onCollectPayment,
  onEditOrder,
}: {
  orders: WholesaleOrder[];
  loading: boolean;
  error: unknown;
  search: string;
  onSearch: (v: string) => void;
  status: string;
  onStatus: (v: string) => void;
  onNew: () => void;
  onCollectPayment: (o: WholesaleOrder) => void;
  onEditOrder: (o: WholesaleOrder) => void;
}) {
  const update = useUpdateWholesaleOrder();
  const cancel = useCancelWholesaleOrder();
  const [failure, setFailure] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setFailure(null);
    try {
      await action();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Action failed");
    }
  }

  return (
    <Card className="p-5 shadow-card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 min-w-64 flex-1">
          <div className="relative flex-1 min-w-56">
            <input
              className={`${fieldClass} w-full pl-9`}
              placeholder="Search order #, consignment ID or customer name..."
              value={search}
              onChange={(e) => onSearch(e.target.value)}
            />
            <div className="absolute left-3 top-2.5 text-muted pointer-events-none">
              <Icon name="search" size={18} />
            </div>
          </div>
          <select
            className={fieldClass}
            value={status}
            onChange={(e) => onStatus(e.target.value)}
          >
            <option value="ALL">All Order Statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            disabled={exporting}
            onClick={async () => {
              setFailure(null);
              setExporting(true);
              try {
                // Exports exactly what the filters above are showing, not the
                // whole table — the same where-clause serves both server-side.
                await downloadWholesaleOrdersCsv(search, status);
              } catch (e) {
                setFailure(e instanceof Error ? e.message : "Couldn't export");
              } finally {
                setExporting(false);
              }
            }}
          >
            <Icon name="download" size={18} />
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
          <Button variant="primary" onClick={onNew}>
            <Icon name="add" size={18} />
            New Order
          </Button>
        </div>
      </div>

      <p className="text-xs text-secondary">
        Buyers hold separate orders — each retains its independent invoice,
        courier, and tracking details.
      </p>

      {failure && (
        <div className="rounded-lg bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
          {failure}
        </div>
      )}
      {error instanceof Error && (
        <div className="rounded-lg bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
          {error.message}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="border-b border-border bg-surface-2 text-xs text-secondary">
            <tr>
              {[
                "Order",
                "Customer",
                "Courier",
                "Consignment ID",
                "Total",
                "Paid",
                "Outstanding Due",
                "Status",
                "Actions",
              ].map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-3 font-bold ${
                    i >= 4 && i <= 6
                      ? "text-right"
                      : i === 8
                        ? "text-right"
                        : "text-left"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-12 text-center text-xs text-secondary"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Icon
                      name="sync"
                      className="animate-spin text-brand-500"
                      size={18}
                    />
                    <span>Loading wholesale orders...</span>
                  </div>
                </td>
              </tr>
            )}
            {!loading && orders.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-12 text-center text-xs text-secondary"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Icon
                      name="receipt_long"
                      size={32}
                      className="text-muted"
                    />
                    <span className="font-semibold text-text">
                      No wholesale orders found
                    </span>
                    <span className="text-[11px] text-muted">
                      Create a new order to get started
                    </span>
                  </div>
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr
                key={o.id}
                className="hover:bg-surface-2/60 transition-colors align-top"
              >
                <td className="px-4 py-3.5">
                  <div className="font-bold text-text">{o.orderNumber}</div>
                  <div className="text-[11px] text-secondary">
                    {new Date(o.placedAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                  {o.invoiceDocNo && (
                    <span className="mt-1 inline-block rounded-md bg-surface-2 border border-border px-1.5 py-0.5 text-[10px] font-bold text-secondary">
                      Doc: {o.invoiceDocNo}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <div className="font-semibold text-text">
                    {o.customerName}
                  </div>
                  <div className="text-xs text-secondary">
                    {o.customerPhone ?? "No phone"}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-xs font-semibold text-text">
                    <Icon
                      name="local_shipping"
                      size={14}
                      className="text-brand-500"
                    />
                    {courierLabel(o.courier)}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <input
                    className="h-8 w-36 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-text outline-none transition-all focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                    defaultValue={o.consignmentId ?? ""}
                    placeholder="Enter ID + Blur"
                    disabled={o.status === "CANCELLED"}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value === (o.consignmentId ?? "")) return;
                      void run(() =>
                        update.mutateAsync({
                          id: o.id,
                          consignmentId: value,
                        }),
                      );
                    }}
                  />
                </td>
                <td className="px-4 py-3.5 text-right font-bold text-text">
                  {money(o.total)}
                </td>
                <td className="px-4 py-3.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                  {money(o.paid)}
                </td>
                <td
                  className={`px-4 py-3.5 text-right font-bold ${
                    Number(o.due) > 0
                      ? "text-rose-600 dark:text-rose-400 font-extrabold"
                      : "text-text"
                  }`}
                >
                  {money(o.due)}
                </td>
                <td className="px-4 py-3.5">
                  <select
                    className={`h-8 rounded-lg border border-border px-2.5 text-xs ${STATUS_TONE[o.status].select}`}
                    value={o.status}
                    disabled={o.status === "CANCELLED"}
                    onChange={(e) =>
                      void run(() =>
                        update.mutateAsync({
                          id: o.id,
                          status: e.target.value as WholesaleOrderStatus,
                        }),
                      )
                    }
                  >
                    {ORDER_STATUSES.filter(
                      (s) =>
                        s.value !== "CANCELLED" || o.status === "CANCELLED",
                    ).map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {Number(o.due) > 0 && (
                      <Button
                        variant="ghost"
                        onClick={() => onCollectPayment(o)}
                        className="text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-500/10"
                      >
                        <Icon name="payments" size={16} />
                        Collect
                      </Button>
                    )}
                    {/* Opens the print view, which renders through
                        Settings > Invoice Template when one is enabled. New
                        tab so the admin does not lose their place in the
                        list, and the browser's print dialog also does
                        Save as PDF. */}
                    <a
                      href={wholesaleInvoiceHref(o.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-secondary hover:bg-surface-2 hover:text-text"
                    >
                      <Icon name="receipt_long" size={16} />
                      Invoice
                    </a>
                    {o.status !== "CANCELLED" && (
                      <Button
                        variant="ghost"
                        onClick={() => onEditOrder(o)}
                        className="text-xs text-secondary hover:bg-surface-2 hover:text-text"
                      >
                        <Icon name="edit" size={16} />
                        Edit
                      </Button>
                    )}
                    {o.status !== "CANCELLED" && (
                      <Button
                        variant="ghost"
                        disabled={cancel.isPending}
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Cancel order ${o.orderNumber}? Stock will be released back into inventory.`,
                            )
                          )
                            return;
                          void run(() => cancel.mutateAsync(o.id));
                        }}
                        className="text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                      >
                        <Icon name="cancel" size={16} />
                        Cancel
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function CustomersTab({
  customers,
  loading,
  error,
  search,
  onSearch,
  activeOnly,
  onActiveOnly,
  onNew,
  onEdit,
  onOrder,
}: {
  customers: WholesaleCustomer[];
  loading: boolean;
  error: unknown;
  search: string;
  onSearch: (v: string) => void;
  activeOnly: boolean;
  onActiveOnly: (v: boolean) => void;
  onNew: () => void;
  onEdit: (c: WholesaleCustomer) => void;
  onOrder: (c: WholesaleCustomer) => void;
}) {
  const remove = useDeleteWholesaleCustomer();
  const [failure, setFailure] = useState<string | null>(null);

  return (
    <Card className="p-5 shadow-card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 min-w-64 flex-1">
          <div className="relative flex-1 min-w-56">
            <input
              className={`${fieldClass} w-full pl-9`}
              placeholder="Search shop name, phone or address..."
              value={search}
              onChange={(e) => onSearch(e.target.value)}
            />
            <div className="absolute left-3 top-2.5 text-muted pointer-events-none">
              <Icon name="search" size={18} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-secondary select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
              checked={activeOnly}
              onChange={(e) => onActiveOnly(e.target.checked)}
            />
            Active Accounts Only
          </label>
        </div>

        <Button variant="primary" onClick={onNew}>
          <Icon name="person_add" size={18} />
          Add Customer
        </Button>
      </div>

      <p className="text-xs text-secondary">
        Wholesale accounts exist independently from retail customers while
        integrating directly into Accounts balances.
      </p>

      {failure && (
        <div className="rounded-lg bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
          {failure}
        </div>
      )}
      {error instanceof Error && (
        <div className="rounded-lg bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
          {error.message}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-border bg-surface-2 text-xs text-secondary">
            <tr>
              {[
                "Customer / Shop",
                "Phone Number",
                "Address",
                "Orders",
                "Total Purchased",
                "Outstanding Due",
                "Status",
                "Actions",
              ].map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-3 font-bold ${
                    i === 3
                      ? "text-center"
                      : i >= 4 && i <= 5
                        ? "text-right"
                        : i === 7
                          ? "text-right"
                          : "text-left"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-xs text-secondary"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Icon
                      name="sync"
                      className="animate-spin text-brand-500"
                      size={18}
                    />
                    <span>Loading wholesale customers...</span>
                  </div>
                </td>
              </tr>
            )}
            {!loading && customers.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-xs text-secondary"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Icon name="store" size={32} className="text-muted" />
                    <span className="font-semibold text-text">
                      No wholesale customers found
                    </span>
                    <span className="text-[11px] text-muted">
                      Add a shop customer to begin issuing wholesale orders
                    </span>
                  </div>
                </td>
              </tr>
            )}
            {customers.map((c) => (
              <tr
                key={c.id}
                className="hover:bg-surface-2/60 transition-colors"
              >
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/15 font-bold text-brand-600 dark:text-brand-400">
                      {c.name.trim().charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-text">{c.name}</div>
                      {c.note && (
                        <div className="text-[11px] text-muted truncate max-w-48">
                          {c.note}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5 font-medium text-text">
                  {c.phone ?? "—"}
                </td>
                <td className="px-4 py-3.5 text-secondary text-xs max-w-56 truncate">
                  {c.address ?? "—"}
                </td>
                <td className="px-4 py-3.5 text-center font-bold text-text">
                  {c.orderCount}
                </td>
                <td className="px-4 py-3.5 text-right font-bold text-text">
                  {money(c.purchaseTotal)}
                </td>
                <td
                  className={`px-4 py-3.5 text-right font-bold ${
                    Number(c.due) > 0
                      ? "text-rose-600 dark:text-rose-400 font-extrabold"
                      : "text-text"
                  }`}
                >
                  {money(c.due)}
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      c.isActive
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                    }`}
                  >
                    {c.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      disabled={!c.isActive}
                      onClick={() => onOrder(c)}
                      className="text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-500/10"
                    >
                      <Icon name="add_shopping_cart" size={16} />
                      Order
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => onEdit(c)}
                      className="text-xs text-secondary hover:text-text"
                    >
                      <Icon name="edit" size={16} />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={remove.isPending}
                      onClick={async () => {
                        if (
                          !window.confirm(
                            `Delete wholesale customer ${c.name}?`,
                          )
                        )
                          return;
                        setFailure(null);
                        try {
                          await remove.mutateAsync(c.id);
                        } catch (e) {
                          setFailure(
                            e instanceof Error
                              ? e.message
                              : "Couldn't delete customer",
                          );
                        }
                      }}
                      className="text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                    >
                      <Icon name="delete" size={16} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
