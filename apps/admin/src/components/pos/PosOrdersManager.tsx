"use client";

import { confirmDialog, promptDialog } from "@/components/PosConfirm";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@amader/admin-ui";
import { useToast } from "@/components/ToastProvider";
import { proxyFetch } from "@/lib/api/proxy-client";
import { usePosSale, useReturnSale } from "@/hooks/usePos";
import { taka } from "@/lib/pos-cart";
import { exportAllPagesXlsx } from "@/lib/pos-export";
import { reportTitle } from "@/lib/reportTitle";
import {
  NO_PERIOD,
  PeriodFilter,
  periodParams,
  type Period,
} from "./PeriodFilter";

type Row = {
  id: number;
  orderNumber: string;
  createdAt: string;
  status: string;
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
  counts: { ALL: number; COMPLETED: number; RETURNED: number };
};
type TrashRow = {
  id: number;
  orderNumber: string;
  createdAt: string;
  deletedAt: string;
  totalAmount: string;
  posVoidedByDelete: boolean;
  store: { name: string } | null;
  customer: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  } | null;
};

const TENDER_LABEL: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  BKASH: "Mobile Banking",
};
const PAGE_SIZE = 25;
const TRASH_DAYS = 30;
const GREEN = "#1d7a46";

const qs = (o: Record<string, string | number | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o))
    if (v !== null && v !== undefined && v !== "") p.set(k, String(v));
  return p.toString();
};
const when = (d: string) =>
  new Date(d).toLocaleString("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  });
const fieldBox =
  "flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm";

/**
 * POS Order Manager. `storeId` fixed = one shop's orders (the POS's own
 * page); `stores` given = every store with a store filter (admin panel).
 */
export function PosOrdersManager({
  storeId: fixedStore,
  storeName: fixedStoreName,
  stores,
  can,
  initialQuery = "",
}: {
  storeId?: number;
  /** Name of the fixed store (export title). */
  storeName?: string;
  stores?: { id: number; name: string }[];
  can: (perm: string) => boolean;
  initialQuery?: string;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [storeFilter, setStoreFilter] = useState<number | null>(null);
  const [tab, setTab] = useState<"" | "COMPLETED" | "RETURNED" | "TRASH">("");
  const [tender, setTender] = useState("");
  const [period, setPeriod] = useState<Period>(NO_PERIOD);
  const [exporting, setExporting] = useState(false);
  const [q, setQ] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const storeId = fixedStore ?? storeFilter;

  const params = {
    storeId,
    status: tab === "TRASH" ? "" : tab,
    tender,
    ...periodParams(period),
    q: q.trim(),
    page,
    pageSize: PAGE_SIZE,
  };
  const { data, isLoading, error } = useQuery({
    queryKey: ["pos-orders", params],
    queryFn: () => proxyFetch<Page>(`/admin/pos/orders?${qs(params)}`),
    placeholderData: (prev) => prev,
  });
  const trash = useQuery({
    queryKey: ["pos-orders-trash", storeId],
    queryFn: () =>
      proxyFetch<TrashRow[]>(`/admin/pos/orders/trash?${qs({ storeId })}`),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["pos-orders"] });
    qc.invalidateQueries({ queryKey: ["pos-orders-trash"] });
    qc.invalidateQueries({ queryKey: ["pos-catalog"] });
    qc.invalidateQueries({ queryKey: ["pos-stats"] });
  };
  const del = useMutation({
    mutationFn: (id: number) =>
      proxyFetch(`/admin/pos/orders/${id}?${qs({ storeId })}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      refresh();
      setOpen(null);
      toast.push("Moved to Trash — stock returned, money reversed", "success");
    },
    onError: (e) => toast.push(e.message),
  });
  const restore = useMutation({
    mutationFn: (id: number) =>
      proxyFetch(`/admin/pos/orders/${id}/restore?${qs({ storeId })}`, {
        method: "POST",
      }),
    onSuccess: () => {
      refresh();
      toast.push("Order restored", "success");
    },
    onError: (e) => toast.push(e.message),
  });
  const askDelete = (o: {
    id: number;
    orderNumber: string;
    status: string;
    totalAmount: string;
    store?: { name: string } | null;
  }) => {
    const undo =
      o.status === "COMPLETED"
        ? `Stock goes back to ${o.store?.name ?? "the store"} and ${taka(Number(o.totalAmount))} is reversed in Accounts. `
        : "";
    void confirmDialog({
      title: `Delete ${o.orderNumber}?`,
      message: `${undo}It stays in Trash for ${TRASH_DAYS} days (Restore puts it back), then it is removed for good.`,
      confirmLabel: "Delete order",
      tone: "danger",
    }).then((ok) => ok && del.mutate(o.id));
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const storeName =
        fixedStoreName ??
        stores?.find((x) => x.id === storeFilter)?.name ??
        "All stores";
      const n = await exportAllPagesXlsx<Row>(
        "/admin/pos/orders",
        { ...params, page: undefined, pageSize: undefined },
        [
          "Order",
          "Date",
          "Time",
          "Store",
          "Customer",
          "Phone",
          "Items",
          "Payment",
          "Total (৳)",
          "Status",
          "Cashier",
        ],
        (o) => {
          const d = new Date(o.createdAt);
          return [
            o.orderNumber,
            d.toLocaleDateString("en-GB"),
            d.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            o.store?.name ?? "",
            o.customer?.name ?? "Walk-in",
            o.customer?.phone ?? "",
            o.itemCount,
            o.tender ? (TENDER_LABEL[o.tender] ?? o.tender) : "",
            Number(o.totalAmount),
            o.status === "RETURNED" ? "Returned" : "Completed",
            o.cashier ?? "",
          ];
        },
        `pos-orders-${new Date().toISOString().slice(0, 10)}.xlsx`,
        reportTitle(`POS Orders — ${storeName}`, periodParams(period)),
      );
      toast.push(`Exported ${n} order${n === 1 ? "" : "s"}`, "success");
    } catch (e) {
      toast.push((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const trashCount = trash.data?.length ?? 0;
  const showStore = !fixedStore;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        {(
          [
            ["Total orders", data?.counts.ALL, "receipt_long"],
            ["Completed", data?.counts.COMPLETED, "check_circle"],
            ["Returned", data?.counts.RETURNED, "undo"],
          ] as const
        ).map(([label, n, icon]) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
          >
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-emerald-50 text-[#1d7a46]">
              <Icon name={icon} size={26} />
            </span>
            <div className="flex-1">
              <div className="text-sm text-gray-600">{label}</div>
              <div className="text-3xl font-extrabold">{n ?? "—"}</div>
            </div>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emerald-50 text-[#1d7a46]">
              <Icon name={icon} size={22} />
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-1 border-b border-gray-100 px-1">
          {(
            [
              ["", "All", data?.counts.ALL],
              ["COMPLETED", "Completed", data?.counts.COMPLETED],
              ["RETURNED", "Returned", data?.counts.RETURNED],
              ["TRASH", "Trash", trashCount],
            ] as const
          ).map(([v, label, n]) => (
            <button
              key={v}
              onClick={() => reset(() => setTab(v))}
              className={`-mb-px flex items-center gap-2 border-b-[3px] px-5 py-3 text-sm font-bold ${tab === v ? "border-[#1d7a46] text-[#1d7a46]" : "border-transparent text-gray-600 hover:text-gray-900"}`}
            >
              {v === "TRASH" && <Icon name="delete" size={18} />}
              {label}
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs ${tab === v ? "bg-emerald-50 text-[#1d7a46]" : "bg-gray-100 text-gray-700"}`}
              >
                {n ?? 0}
              </span>
            </button>
          ))}
        </div>

        {tab !== "TRASH" && (
          <div className="flex flex-wrap items-center gap-3 py-4">
            {showStore && stores && (
              <label className={fieldBox}>
                <Icon name="storefront" size={20} className="text-[#1d7a46]" />
                <select
                  value={storeFilter ?? ""}
                  onChange={(e) =>
                    reset(() =>
                      setStoreFilter(
                        e.target.value ? Number(e.target.value) : null,
                      ),
                    )
                  }
                  className="bg-transparent pr-2 outline-none"
                  aria-label="Store"
                >
                  <option value="">All stores</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className={fieldBox}>
              <Icon name="credit_card" size={20} className="text-[#1d7a46]" />
              <select
                value={tender}
                onChange={(e) => reset(() => setTender(e.target.value))}
                className="bg-transparent pr-2 outline-none"
                aria-label="Payment"
              >
                <option value="">All payments</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="MOBILE">Mobile Banking</option>
              </select>
            </label>
            <PeriodFilter
              value={period}
              onChange={(p) => reset(() => setPeriod(p))}
            />
            <label className={`${fieldBox} min-w-[240px] flex-1`}>
              <Icon name="search" size={20} className="text-gray-500" />
              <input
                value={q}
                onChange={(e) => reset(() => setQ(e.target.value))}
                placeholder="Search order no., phone or name..."
                className="flex-1 bg-transparent outline-none"
              />
            </label>
            <button
              onClick={exportExcel}
              disabled={exporting || !data?.total}
              className="flex h-11 items-center gap-2 rounded-xl bg-[#1d7a46] px-4 text-sm font-bold text-white hover:bg-[#186a3c] disabled:opacity-50"
            >
              <Icon name="download" size={20} />
              {exporting ? "Exporting…" : "Export Excel"}
            </button>
          </div>
        )}

        {tab === "TRASH" ? (
          <TrashTable
            rows={trash.data ?? []}
            loading={trash.isLoading}
            showStore={showStore}
            canRestore={can("pos.refund")}
            busy={restore.isPending}
            onRestore={(id) => restore.mutate(id)}
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl">
              <table className="w-full text-sm">
                <thead
                  className="text-left text-white"
                  style={{ background: GREEN }}
                >
                  <tr>
                    <th className="px-5 py-4 font-bold">Order</th>
                    <th className="px-4 font-bold">Date</th>
                    {showStore && <th className="px-4 font-bold">Store</th>}
                    <th className="px-4 font-bold">Customer</th>
                    <th className="px-4 text-center font-bold">Items</th>
                    <th className="px-4 font-bold">Payment</th>
                    <th className="px-4 font-bold">Total</th>
                    <th className="px-4 font-bold">Status</th>
                    <th className="px-4 font-bold">Cashier</th>
                    <th className="w-12 px-2" />
                  </tr>
                </thead>
                <tbody>
                  {(isLoading || error || data?.items.length === 0) && (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-5 py-10 text-center text-gray-500"
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
                      className="cursor-pointer border-b border-gray-100 hover:bg-emerald-50/40"
                    >
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-2 font-bold text-[#1d7a46]">
                          {o.orderNumber}
                          <a
                            href={`/pos/receipt/${o.id}`}
                            target="_blank"
                            rel="noopener"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Open receipt ${o.orderNumber}`}
                            title="Open receipt"
                          >
                            <Icon name="open_in_new" size={18} />
                          </a>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 text-gray-600">
                        {when(o.createdAt)}
                      </td>
                      {showStore && <td className="px-4">{o.store?.name}</td>}
                      <td className="px-4">
                        {o.customer ? (
                          <>
                            <div className="font-semibold">
                              {o.customer.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {o.customer.phone}
                            </div>
                          </>
                        ) : (
                          <span className="text-gray-400">Walk-in</span>
                        )}
                      </td>
                      <td className="px-4 text-center">{o.itemCount}</td>
                      <td className="px-4">
                        {o.tender ? (TENDER_LABEL[o.tender] ?? o.tender) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 text-base font-extrabold">
                        {taka(Number(o.totalAmount))}
                      </td>
                      <td className="px-4">
                        <StatusPill status={o.status} />
                      </td>
                      <td className="px-4 text-gray-600">{o.cashier}</td>
                      <td className="px-2">
                        {can("pos.refund") && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              askDelete(o);
                            }}
                            disabled={del.isPending}
                            className="grid h-8 w-8 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40"
                            aria-label={`Delete ${o.orderNumber}`}
                            title="Delete (to Trash)"
                          >
                            <Icon name="delete" size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-3 pt-4 text-sm text-gray-600">
              <span>
                {data?.total ?? 0} order{data?.total === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  className="h-10 rounded-xl border border-gray-200 px-4 disabled:opacity-40"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {pages}
                </span>
                <button
                  className="h-10 rounded-xl border border-gray-200 px-4 disabled:opacity-40"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      {open && (
        <OrderDetail
          id={open}
          can={can}
          onClose={() => setOpen(null)}
          onDelete={askDelete}
        />
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const returned = status === "RETURNED";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${returned ? "bg-red-50 text-red-700" : "bg-emerald-50 text-[#1d7a46]"}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${returned ? "bg-red-600" : "bg-[#1d7a46]"}`}
      />
      {returned ? "Returned" : "Completed"}
    </span>
  );
}

function TrashTable({
  rows,
  loading,
  showStore,
  canRestore,
  busy,
  onRestore,
}: {
  rows: TrashRow[];
  loading: boolean;
  showStore: boolean;
  canRestore: boolean;
  busy: boolean;
  onRestore: (id: number) => void;
}) {
  // Read once per visit to the tab (render must stay pure).
  const [now] = useState(() => Date.now());
  const daysLeft = (d: string) =>
    Math.max(
      0,
      TRASH_DAYS - Math.floor((now - new Date(d).getTime()) / 86_400_000),
    );
  return (
    <div className="pt-4">
      <p className="mb-3 flex items-center gap-2 px-2 text-sm text-gray-600">
        <Icon name="info" size={18} className="text-[#1d7a46]" />
        Deleted orders stay here for {TRASH_DAYS} days, then they are removed
        for good. Restore puts a sale back (stock out, money in again).
      </p>
      <div className="overflow-x-auto rounded-xl">
        <table className="w-full text-sm">
          <thead className="text-left text-white" style={{ background: GREEN }}>
            <tr>
              <th className="px-5 py-4 font-bold">Order</th>
              <th className="px-4 font-bold">Sold</th>
              {showStore && <th className="px-4 font-bold">Store</th>}
              <th className="px-4 font-bold">Customer</th>
              <th className="px-4 font-bold">Total</th>
              <th className="px-4 font-bold">Deleted</th>
              <th className="px-4 font-bold">Removed in</th>
              <th className="px-4" />
            </tr>
          </thead>
          <tbody>
            {(loading || rows.length === 0) && (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-10 text-center text-gray-500"
                >
                  {loading ? "Loading…" : "Trash is empty."}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-gray-100">
                <td className="px-5 py-4 font-bold text-gray-700">
                  {r.orderNumber}
                </td>
                <td className="whitespace-nowrap px-4 text-gray-600">
                  {when(r.createdAt)}
                </td>
                {showStore && <td className="px-4">{r.store?.name}</td>}
                <td className="px-4">
                  {r.customer
                    ? [r.customer.firstName, r.customer.lastName]
                        .filter(Boolean)
                        .join(" ") || r.customer.phone
                    : "Walk-in"}
                </td>
                <td className="px-4 font-bold">
                  {taka(Number(r.totalAmount))}
                </td>
                <td className="whitespace-nowrap px-4 text-gray-600">
                  {when(r.deletedAt)}
                </td>
                <td className="px-4">
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                    {daysLeft(r.deletedAt)} days
                  </span>
                </td>
                <td className="px-4 text-right">
                  {canRestore && (
                    <button
                      onClick={() => onRestore(r.id)}
                      disabled={busy}
                      className="flex items-center gap-1 rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-bold text-[#1d7a46] hover:bg-emerald-50 disabled:opacity-40"
                    >
                      <Icon name="restore_from_trash" size={16} /> Restore
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrderDetail({
  id,
  can,
  onClose,
  onDelete,
}: {
  id: number;
  can: (perm: string) => boolean;
  onClose: () => void;
  onDelete: (o: {
    id: number;
    orderNumber: string;
    status: string;
    totalAmount: string;
    store?: { name: string } | null;
  }) => void;
}) {
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
                  onClick={async () => {
                    const reason = await promptDialog({
                      title: `Return ${s.orderNumber}?`,
                      message: `Stock goes back to ${s.store?.name} and ${taka(Number(s.totalAmount))} is refunded.`,
                      placeholder: "Reason (optional)",
                      confirmLabel: "Return sale",
                      tone: "danger",
                      icon: "undo",
                    });
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
              {can("pos.refund") && (
                <button
                  className="flex h-10 items-center gap-1 rounded-lg border border-red-200 px-3 text-sm font-bold text-red-700"
                  onClick={() => onDelete(s)}
                >
                  <Icon name="delete" size={18} /> Delete
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
