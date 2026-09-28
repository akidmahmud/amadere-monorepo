"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@amader/admin-ui";
import { useToast } from "@/components/ToastProvider";
import { proxyFetch } from "@/lib/api/proxy-client";
import { usePosSale, useReturnSale } from "@/hooks/usePos";
import { taka } from "@/lib/pos-cart";
import { usePosContext } from "@/components/pos/PosContext";
import { PosSubPage, input } from "@/components/pos/PosSubPage";
import { StoreFilter } from "@/components/pos/StoreFilter";

type Row = {
  id: number;
  orderNumber: string;
  createdAt: string;
  status: "COMPLETED" | "RETURNED" | string;
  subTotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  store: { id: number; name: string } | null;
  customer: { name: string; phone: string | null } | null;
  cashier: string | null;
  itemCount: number;
  tender: string | null;
};
type Page = {
  items: Row[];
  total: number;
  page: number;
  pageSize: number;
  counts: { ALL: number; COMPLETED: number; RETURNED: number };
};

const TENDER_LABEL: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  BKASH: "Mobile Banking",
};
const TABS = [
  ["", "All"],
  ["COMPLETED", "Completed"],
  ["RETURNED", "Returned"],
] as const;
const PAGE_SIZE = 25;

const qs = (o: Record<string, string | number | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o))
    if (v !== null && v !== undefined && v !== "") p.set(k, String(v));
  return p.toString();
};

/** Every store's till sales (or one store's) — kept out of the website Order Manager. */
export default function PosOrdersPage() {
  const { allStores } = usePosContext();
  const [storeId, setStoreId] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [tender, setTender] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // "Orders" from the Customer Manager arrives with ?q=<phone>.
  const [q, setQ] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("q") ?? ""),
  );
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);

  const params = {
    storeId: allStores ? storeId : null,
    status,
    tender,
    from,
    to: to || from,
    q: q.trim(),
    page,
    pageSize: PAGE_SIZE,
  };
  const { data, isLoading, error } = useQuery({
    queryKey: ["pos-orders", params],
    queryFn: () => proxyFetch<Page>(`/admin/pos/orders?${qs(params)}`),
    placeholderData: (prev) => prev,
  });
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <PosSubPage
      title="Order Manager"
      permission="pos.orders"
      wide
      hideStorePicker
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {(
            [
              ["Total orders", data?.counts.ALL, "receipt_long"],
              ["Completed", data?.counts.COMPLETED, "check_circle"],
              ["Returned", data?.counts.RETURNED, "undo"],
            ] as const
          ).map(([label, n, icon]) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div>
                <div className="text-sm text-gray-600">{label}</div>
                <div className="mt-1 text-2xl font-extrabold">{n ?? "—"}</div>
              </div>
              <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-[#1d7a46]">
                <Icon name={icon} size={24} />
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-wrap gap-1 border-b border-gray-100 px-3 pt-3">
            {TABS.map(([v, label]) => (
              <button
                key={v}
                onClick={() => reset(() => setStatus(v))}
                className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-bold ${status === v ? "border-[#1d7a46] text-[#1d7a46]" : "border-transparent text-gray-500 hover:text-gray-800"}`}
              >
                {label}{" "}
                <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                  {data?.counts[(v || "ALL") as keyof Page["counts"]] ?? 0}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 p-3">
            <StoreFilter
              value={storeId}
              onChange={(v) => reset(() => setStoreId(v))}
            />
            <select
              value={tender}
              onChange={(e) => reset(() => setTender(e.target.value))}
              className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm"
              aria-label="Payment"
            >
              <option value="">All payments</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="MOBILE">Mobile Banking</option>
            </select>
            <label className="flex items-center gap-1 text-sm text-gray-600">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => reset(() => setFrom(e.target.value))}
                className={input}
              />
            </label>
            <label className="flex items-center gap-1 text-sm text-gray-600">
              To
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => reset(() => setTo(e.target.value))}
                className={input}
              />
            </label>
            <input
              value={q}
              onChange={(e) => reset(() => setQ(e.target.value))}
              placeholder="Search order no., phone or name…"
              className={`${input} min-w-[220px] flex-1`}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-3">Date</th>
                  <th className="px-3">Store</th>
                  <th className="px-3">Customer</th>
                  <th className="px-3 text-right">Items</th>
                  <th className="px-3">Payment</th>
                  <th className="px-3 text-right">Total</th>
                  <th className="px-3">Status</th>
                  <th className="px-3">Cashier</th>
                </tr>
              </thead>
              <tbody>
                {(isLoading || error || data?.items.length === 0) && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      {isLoading
                        ? "Loading…"
                        : error
                          ? (error as Error).message
                          : "No orders match these filters."}
                    </td>
                  </tr>
                )}
                {data?.items.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setOpen(o.id)}
                    className="cursor-pointer border-t border-gray-100 hover:bg-emerald-50/50"
                  >
                    <td className="px-4 py-3 font-bold text-[#1d7a46]">
                      {o.orderNumber}
                    </td>
                    <td className="whitespace-nowrap px-3 text-gray-600">
                      {new Date(o.createdAt).toLocaleString("en-GB", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-3">{o.store?.name}</td>
                    <td className="px-3">
                      {o.customer ? (
                        <>
                          <div className="font-semibold">{o.customer.name}</div>
                          <div className="text-xs text-gray-500">
                            {o.customer.phone}
                          </div>
                        </>
                      ) : (
                        <span className="text-gray-400">Walk-in</span>
                      )}
                    </td>
                    <td className="px-3 text-right">{o.itemCount}</td>
                    <td className="px-3">
                      {o.tender ? (TENDER_LABEL[o.tender] ?? o.tender) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 text-right font-bold">
                      {taka(Number(o.totalAmount))}
                    </td>
                    <td className="px-3">
                      <StatusPill status={o.status} />
                    </td>
                    <td className="px-3 text-gray-600">{o.cashier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
            <span>
              {data?.total ?? 0} order{data?.total === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <button
                className="h-9 rounded-lg border border-gray-200 px-3 disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span>
                Page {page} of {pages}
              </span>
              <button
                className="h-9 rounded-lg border border-gray-200 px-3 disabled:opacity-40"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
      {open && <OrderDetail id={open} onClose={() => setOpen(null)} />}
    </PosSubPage>
  );
}

function StatusPill({ status }: { status: string }) {
  const returned = status === "RETURNED";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-bold ${returned ? "bg-red-50 text-red-700" : "bg-emerald-50 text-[#1d7a46]"}`}
    >
      {returned ? "Returned" : "Completed"}
    </span>
  );
}

function OrderDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { can } = usePosContext();
  const toast = useToast();
  const { data: s, isLoading } = usePosSale(id);
  const ret = useReturnSale();
  const row = (label: string, value: string, strong = false) => (
    <div className={`flex justify-between ${strong ? "font-bold" : ""}`}>
      <span className={strong ? "" : "text-gray-600"}>{label}</span>
      <span>{value}</span>
    </div>
  );
  const vatDiscount = Number(s?.posVatDiscount ?? 0);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Order details"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading || !s ? (
          <div className="py-10 text-center text-gray-500">Loading…</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{s.orderNumber}</h2>
                <p className="text-sm text-gray-500">
                  {new Date(s.createdAt).toLocaleString("en-GB")} ·{" "}
                  {s.store?.name}
                </p>
              </div>
              <StatusPill status={s.status} />
            </div>
            <div className="text-sm">
              <b>Customer:</b>{" "}
              {s.customer
                ? `${[s.customer.firstName, s.customer.lastName].filter(Boolean).join(" ") || "Customer"} · ${s.customer.phone ?? ""}`
                : "Walk-in"}
              <br />
              <b>Cashier:</b>{" "}
              {s.assignedAdmin
                ? `${s.assignedAdmin.firstName} ${s.assignedAdmin.lastName}`
                : "—"}
              <br />
              <b>Payment:</b>{" "}
              {s.payments[0]
                ? (TENDER_LABEL[s.payments[0].provider] ??
                  s.payments[0].provider)
                : "—"}
              {s.payments[0]?.transactionRef
                ? ` · Ref ${s.payments[0].transactionRef}`
                : ""}
            </div>
            <table className="w-full text-sm">
              <tbody>
                {s.items.map((i) => (
                  <tr key={i.id} className="border-t border-gray-100">
                    <td className="py-2">
                      {i.productNameSnapshot}
                      {i.variantLabel && (
                        <span className="text-gray-500">
                          {" "}
                          · {i.variantLabel}
                        </span>
                      )}
                    </td>
                    <td className="text-right text-gray-600">
                      {i.quantity} × {taka(Number(i.unitPrice))}
                    </td>
                    <td className="text-right font-semibold">
                      {taka(Number(i.unitPrice) * i.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-1 border-t border-gray-100 pt-3 text-sm">
              {row("Subtotal", taka(Number(s.subTotal)))}
              {Number(s.discountAmount) - vatDiscount > 0 &&
                row(
                  "Discount",
                  `−${taka(Number(s.discountAmount) - vatDiscount)}`,
                )}
              {Number(s.taxAmount) > 0 && row("VAT", taka(Number(s.taxAmount)))}
              {vatDiscount > 0 && row("VAT discount", `−${taka(vatDiscount)}`)}
              {row("Total", taka(Number(s.totalAmount)), true)}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="flex h-10 items-center gap-1 rounded-lg bg-[#1d7a46] px-4 text-sm font-bold text-white"
                onClick={() =>
                  window.open(`/pos/receipt/${s.id}`, "_blank", "noopener")
                }
              >
                <Icon name="print" size={18} /> Reprint receipt
              </button>
              {can("pos.refund") && s.status === "COMPLETED" && (
                <button
                  className="h-10 rounded-lg border border-red-200 px-4 text-sm font-bold text-red-700 disabled:opacity-50"
                  disabled={ret.isPending}
                  onClick={() => {
                    const reason = prompt(
                      `Return ${s.orderNumber}? Stock goes back to ${s.store?.name} and ${taka(Number(s.totalAmount))} is refunded.\n\nReason (optional):`,
                    );
                    if (reason === null) return;
                    ret.mutate(
                      { id: s.id, reason: reason || undefined },
                      {
                        onSuccess: () => {
                          toast.push("Sale returned", "success");
                          onClose();
                        },
                        onError: (e) => toast.push(e.message),
                      },
                    );
                  }}
                >
                  Return sale
                </button>
              )}
              <button
                className="ml-auto h-10 rounded-lg border border-gray-200 px-4 text-sm font-semibold"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
