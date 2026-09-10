"use client";

import { useState } from "react";
import { Button, Card, Icon, StatCard } from "@amader/admin-ui";
import {
  COURIERS,
  ORDER_CHANNELS,
  PAGE_SIZE,
  labelOf,
  useWholesaleCustomers,
  useWholesaleOrders,
  useWholesaleStats,
  type WholesaleCustomer,
  type WholesaleOrder,
} from "@/hooks/useWholesale";
import { OrderDetailModal } from "./OrderDetailModal";
import { Pager } from "./Pager";
import {
  OrderCell,
  PaymentCell,
  ProductsCell,
  TypeBadge,
} from "./OrdersDashboard";

const money = (v: string | number) =>
  `৳${Number(v || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const compactMoney = (v: string | number) =>
  `৳${Number(v || 0).toLocaleString("en-BD", { maximumFractionDigits: 0 })}`;

const dateLabel = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "No order yet";

const INPUT =
  "h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none transition-all duration-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 placeholder:text-muted";

export function CustomersDashboard({
  onNewCustomer,
  onEditCustomer,
  onOrderFor,
}: {
  onNewCustomer: () => void;
  onEditCustomer: (c: WholesaleCustomer) => void;
  onOrderFor: (c: WholesaleCustomer) => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<WholesaleCustomer | null>(null);

  const customers = useWholesaleCustomers(search, false, page);
  const stats = useWholesaleStats();
  const rows = customers.data?.items ?? [];
  const total = customers.data?.total ?? 0;
  const s = stats.data;

  if (detail) {
    return (
      <CustomerDetail
        customer={detail}
        onBack={() => setDetail(null)}
        onEdit={() => onEditCustomer(detail)}
        onOrder={() => onOrderFor(detail)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Customers"
          value={String(s?.customerCount ?? 0)}
          footer="Registered wholesale buyers"
          icon={<Icon name="store" size={24} className="text-brand-500" />}
        />
        <StatCard
          label="Wholesale Customers"
          value={String(s?.wholesaleCustomerCount ?? 0)}
          footer="With wholesale history"
          icon={
            <Icon name="local_shipping" size={24} className="text-blue-500" />
          }
        />
        <StatCard
          label="Cash Sale Customers"
          value={String(s?.cashCustomerCount ?? 0)}
          footer="With cash sale history"
          icon={<Icon name="storefront" size={24} className="text-amber-500" />}
        />
        <StatCard
          label="Total Customer Sales"
          value={compactMoney(s?.salesTotal ?? 0)}
          footer={`${compactMoney(s?.dueTotal ?? 0)} still outstanding`}
          icon={<Icon name="payments" size={24} className="text-emerald-500" />}
        />
      </div>

      <Card className="space-y-4 p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-56 flex-1">
            <input
              className={`${INPUT} w-full pl-9`}
              placeholder="Search customer by name, phone, address…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                // A narrower search is a different list; page 3 of the old
                // one is usually past the end of the new one.
                setPage(1);
              }}
            />
            <Icon
              name="search"
              size={18}
              className="pointer-events-none absolute left-3 top-2.5 text-muted"
            />
          </div>
          <Button variant="primary" onClick={onNewCustomer}>
            <Icon name="person_add" size={18} />
            Create New Customer
          </Button>
        </div>

        {customers.isLoading ? (
          <p className="py-10 text-center text-sm text-muted">
            Loading customers…
          </p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            No customer matches that.
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
              <table className="w-full min-w-[980px] border-collapse">
                <thead>
                  <tr className="bg-surface-2 text-[9px] uppercase tracking-wide text-muted">
                    {[
                      "Customer",
                      "Phone",
                      "Address",
                      "Orders",
                      "Wholesale",
                      "Cash Sale",
                      "Total Purchase",
                      "Last Order",
                      "Action",
                    ].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-bold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr
                      key={c.id}
                      className="border-t border-border align-top text-[11px]"
                    >
                      <td className="px-3 py-3">
                        <strong className="block text-text">{c.name}</strong>
                        {c.email && (
                          <span className="text-muted">{c.email}</span>
                        )}
                        {!c.isActive && (
                          <span className="mt-1 inline-block rounded-full bg-surface-2 px-2 py-0.5 text-[9px] font-black text-muted">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="block text-text">{c.phone}</span>
                        {c.alternativePhone && (
                          <span className="text-muted">
                            Alt: {c.alternativePhone}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="block text-text">
                          {c.address ?? "—"}
                        </span>
                        {(c.district || c.thana) && (
                          <span className="text-muted">
                            {[c.district, c.thana].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 font-bold text-text">
                        {c.orderCount}
                      </td>
                      <td className="px-3 py-3 text-secondary">
                        {c.wholesaleCount}
                      </td>
                      <td className="px-3 py-3 text-secondary">{c.cashCount}</td>
                      <td className="px-3 py-3">
                        <strong className="block text-text">
                          {money(c.purchaseTotal)}
                        </strong>
                        {Number(c.due) > 0 && (
                          <span className="text-rose-600 dark:text-rose-400">
                            {money(c.due)} due
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-secondary">
                        {dateLabel(c.lastOrderAt)}
                      </td>
                      <td className="px-3 py-3">
                        <CustomerActions
                          onView={() => setDetail(c)}
                          onEdit={() => onEditCustomer(c)}
                          onOrder={() => onOrderFor(c)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {rows.map((c) => (
                <div
                  key={c.id}
                  className="space-y-2.5 rounded-xl border border-border p-3.5"
                >
                  <div>
                    <strong className="block text-xs text-text">
                      {c.name}
                    </strong>
                    <span className="text-[10px] text-muted">
                      {c.phone}
                      {c.alternativePhone ? ` · Alt ${c.alternativePhone}` : ""}
                    </span>
                  </div>
                  <p className="text-[11px] text-secondary">
                    {[c.address, c.district, c.thana].filter(Boolean).join(" · ") ||
                      "No address on file"}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <Metric label="Orders" value={String(c.orderCount)} />
                    <Metric label="Wholesale" value={String(c.wholesaleCount)} />
                    <Metric label="Cash" value={String(c.cashCount)} />
                  </div>
                  <div className="flex items-end justify-between gap-3 text-[11px]">
                    <span className="text-muted">
                      Last: {dateLabel(c.lastOrderAt)}
                    </span>
                    <div className="text-right">
                      <strong className="block text-sm text-text">
                        {money(c.purchaseTotal)}
                      </strong>
                      {Number(c.due) > 0 && (
                        <span className="text-rose-600 dark:text-rose-400">
                          {money(c.due)} due
                        </span>
                      )}
                    </div>
                  </div>
                  <CustomerActions
                    onView={() => setDetail(c)}
                    onEdit={() => onEditCustomer(c)}
                    onOrder={() => onOrderFor(c)}
                  />
                </div>
              ))}
            </div>
            <Pager
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPage={setPage}
              noun="customers"
            />
          </>
        )}
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-2 text-center">
      <span className="block text-[9px] uppercase tracking-wide text-muted">
        {label}
      </span>
      <strong className="block text-text">{value}</strong>
    </div>
  );
}

function CustomerActions({
  onView,
  onEdit,
  onOrder,
}: {
  onView: () => void;
  onEdit: () => void;
  onOrder: () => void;
}) {
  const link =
    "text-left text-[10px] font-bold text-brand-600 hover:underline dark:text-brand-400";
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      <button type="button" className={link} onClick={onView}>
        View Full History
      </button>
      <button type="button" className={link} onClick={onOrder}>
        New Order
      </button>
      <button type="button" className={link} onClick={onEdit}>
        Edit
      </button>
    </div>
  );
}

function DetailItem({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface-2 p-3 ${
        wide ? "sm:col-span-2" : ""
      }`}
    >
      <span className="block text-[9px] font-bold uppercase tracking-wide text-muted">
        {label}
      </span>
      <strong className="mt-1 block break-words text-[11px] text-text">
        {value || "N/A"}
      </strong>
    </div>
  );
}

/**
 * One buyer's profile and their complete order history.
 *
 * The history is fetched by `partyId` rather than filtered out of the list
 * above: the list is one page of orders, so filtering it client-side would
 * show "complete history" that silently stopped at whatever the last page
 * happened to contain.
 */
function CustomerDetail({
  customer,
  onBack,
  onEdit,
  onOrder,
}: {
  customer: WholesaleCustomer;
  onBack: () => void;
  onEdit: () => void;
  onOrder: () => void;
}) {
  const [page, setPage] = useState(1);
  const history = useWholesaleOrders("", "ALL", "ALL", customer.id, page);
  const [viewing, setViewing] = useState<WholesaleOrder | null>(null);
  const orders = history.data?.items ?? [];
  const total = history.data?.total ?? 0;

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5 shadow-card">
        <div>
          <h2 className="text-base font-bold text-text">
            {customer.name} — Customer Details
          </h2>
          <p className="mt-1 text-xs text-secondary">
            Full profile and complete order history
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="ghost" onClick={onBack}>
            <Icon name="arrow_back" size={18} />
            Back to Customer List
          </Button>
          <Button variant="ghost" onClick={onEdit}>
            Edit Customer
          </Button>
          <Button variant="primary" onClick={onOrder}>
            <Icon name="add" size={18} />
            New Order
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Orders" value={String(customer.orderCount)} />
        <StatCard
          label="Total Purchase"
          value={compactMoney(customer.purchaseTotal)}
          footer={
            Number(customer.due) > 0
              ? `${compactMoney(customer.due)} outstanding`
              : "Settled in full"
          }
        />
        <StatCard
          label="Wholesale Orders"
          value={String(customer.wholesaleCount)}
        />
        <StatCard label="Cash Sale Orders" value={String(customer.cashCount)} />
      </div>

      <Card className="p-0 shadow-card">
        <div className="border-b border-border px-4 py-3.5">
          <h3 className="text-sm font-bold text-text">Customer Profile</h3>
        </div>
        <div className="grid gap-2.5 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailItem label="Customer name" value={customer.name} />
          <DetailItem label="Phone" value={customer.phone ?? ""} />
          <DetailItem
            label="Alternative phone"
            value={customer.alternativePhone ?? ""}
          />
          <DetailItem label="Email" value={customer.email ?? ""} />
          <DetailItem
            label="Address"
            value={customer.address ?? ""}
            wide
          />
          <DetailItem label="District" value={customer.district ?? ""} />
          <DetailItem label="Thana / area" value={customer.thana ?? ""} />
          <DetailItem label="Landmark" value={customer.landmark ?? ""} />
          <DetailItem label="Post code" value={customer.postCode ?? ""} />
          <DetailItem
            label="Credit limit"
            value={customer.creditLimit ? money(customer.creditLimit) : ""}
          />
          <DetailItem
            label="Payment terms"
            value={
              customer.creditDays === null ? "" : `${customer.creditDays} days`
            }
          />
          <DetailItem
            label="Outstanding"
            value={money(customer.due)}
          />
          {customer.note && (
            <DetailItem label="Note" value={customer.note} wide />
          )}
        </div>
      </Card>

      <Card className="p-0 shadow-card">
        <div className="border-b border-border px-4 py-3.5">
          <h3 className="text-sm font-bold text-text">Complete Order History</h3>
        </div>
        {history.isLoading ? (
          <p className="py-10 text-center text-sm text-muted">
            Loading history…
          </p>
        ) : orders.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            No order history yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse">
              <thead>
                <tr className="bg-surface-2 text-[9px] uppercase tracking-wide text-muted">
                  {[
                    "Order",
                    "Type",
                    "Products",
                    "Price Details",
                    "Courier",
                    "Payment",
                    "Total",
                    "Date",
                    "Action",
                  ].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-bold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className="border-t border-border align-top text-[11px]"
                  >
                    <td className="px-3 py-3">
                      <OrderCell order={o} />
                    </td>
                    <td className="px-3 py-3">
                      <TypeBadge type={o.type} />
                    </td>
                    <td className="px-3 py-3">
                      <ProductsCell order={o} />
                    </td>
                    <td className="px-3 py-3 text-secondary">
                      {o.items.map((i) => (
                        <span key={i.id} className="block">
                          {money(i.unitPrice)} × {i.quantity}
                          {Number(i.discount) > 0
                            ? ` − ${money(i.discount)}`
                            : ""}
                        </span>
                      ))}
                    </td>
                    <td className="px-3 py-3">
                      <span className="block text-text">
                        {labelOf(COURIERS, o.courier) || "N/A"}
                      </span>
                      {o.consignmentId && (
                        <span className="text-muted">{o.consignmentId}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <PaymentCell order={o} />
                    </td>
                    <td className="px-3 py-3">
                      <strong className="block text-text">
                        {money(o.total)}
                      </strong>
                      {Number(o.due) > 0 && (
                        <span className="text-rose-600 dark:text-rose-400">
                          {money(o.due)} due
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-secondary">
                      {dateLabel(o.placedAt)}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        className="text-[10px] font-bold text-brand-600 hover:underline dark:text-brand-400"
                        onClick={() => setViewing(o)}
                      >
                        View Order
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 pb-4">
              <Pager
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                onPage={setPage}
                noun="orders"
              />
            </div>
          </div>
        )}
      </Card>

      {viewing && (
        <OrderDetailModal order={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}
