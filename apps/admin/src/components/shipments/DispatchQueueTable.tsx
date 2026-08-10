"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCancelShipment,
  useCourierBalance,
  useDispatchBulkShipment,
  useDispatchShipment,
  useShipmentQueue,
  useTrackShipment,
  type ShipmentProvider,
  type ShipmentQueueRow,
} from "@/hooks/useShipments";
import { useFraudCheck } from "@/hooks/useFraud";
import { useBulkOrderAction } from "@/hooks/useOrderManager";
import { OrderDetailModal, type OrderDetailModalRow } from "@/components/OrderDetailModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const PAGE_SIZES = [10, 30, 50, 100];

const ORDER_STATUS_PILL: Record<string, string> = {
  PENDING: "bg-surface-2 text-secondary",
  CONFIRMED: "bg-[#e8f0fe] text-[#2570eb]",
  PROCESSING: "bg-[#fdf1dc] text-[#e0821c]",
  HOLD: "bg-[#feeaec] text-[#e8465e]",
  COMPLETED: "bg-[#e3f7ee] text-[#16a06d]",
  CANCELED: "bg-surface-2 text-secondary",
  PARTIALLY_RETURNED: "bg-[#fdf1dc] text-[#e0821c]",
  RETURNED: "bg-[#feeaec] text-[#e8465e]",
};

const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  DISPATCHED: "In review",
  IN_TRANSIT: "In transit",
  DELIVERED: "Delivered",
  PARTIALLY_DELIVERED: "Partially delivered",
  RETURNED: "Returned",
  CANCELED: "Canceled",
  FAILED: "Failed",
};

const SHIPMENT_STATUS_PILL: Record<string, string> = {
  PENDING: "bg-surface-2 text-secondary",
  DISPATCHED: "bg-[#fdf1dc] text-[#e0821c]",
  IN_TRANSIT: "bg-[#e8f0fe] text-[#2570eb]",
  DELIVERED: "bg-[#e3f7ee] text-[#16a06d]",
  PARTIALLY_DELIVERED: "bg-[#fdf1dc] text-[#e0821c]",
  RETURNED: "bg-[#feeaec] text-[#e8465e]",
  CANCELED: "bg-surface-2 text-secondary",
  FAILED: "bg-[#feeaec] text-[#e8465e]",
};

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-[6px] px-2.5 py-1 text-[0.68rem] font-bold ${className}`}>{children}</span>;
}

// Reference site's per-row phone lookup ("Fraud Check" column) — reuses the
// existing net-profit/fraud phone-check endpoint instead of building a new
// one; lazy (only fetches once clicked) so opening the queue doesn't fire
// N fraud lookups for every row on screen.
function FraudCheckCell({ phone }: { phone: string | null }) {
  const [checked, setChecked] = useState(false);
  const { data, isLoading } = useFraudCheck(checked && phone ? phone : "");

  if (!phone) return <span className="text-muted">—</span>;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="whitespace-nowrap text-[0.75rem] font-semibold text-text">{phone}</span>
        <button
          type="button"
          onClick={() => setChecked(true)}
          disabled={checked && (isLoading || !!data)}
          className="rounded-[6px] px-1.5 py-0.5 text-[0.68rem] font-bold text-brand-500 hover:bg-brand-50 disabled:opacity-0"
        >
          Check
        </button>
      </div>
      {checked && isLoading && <span className="text-[0.68rem] text-muted">Checking…</span>}
      {checked && data && (
        <Pill
          className={
            data.riskLevel === "HIGH"
              ? "bg-[#feeaec] text-[#e8465e]"
              : data.riskLevel === "MEDIUM"
                ? "bg-[#fdf1dc] text-[#e0821c]"
                : "bg-[#e3f7ee] text-[#16a06d]"
          }
        >
          {data.delivered}/{data.totalOrders} delivered
          {data.successRate !== null ? ` (${data.successRate}%)` : ""}
        </Pill>
      )}
    </div>
  );
}

// Editable "Amount" cell — the reference's own dispatch queue lets staff
// review/adjust the COD amount before sending; defaults to the order's
// computed pending-COD amount, blank/disabled once a shipment already
// exists (the amount was already locked in at dispatch time).
function AmountCell({ row, value, onChange }: { row: ShipmentQueueRow; value: string; onChange: (v: string) => void }) {
  if (row.shipment) {
    return <span className="text-muted">—</span>;
  }
  if (row.pendingCodAmount === null) {
    return <span className="text-muted">Not COD</span>;
  }
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-24 rounded-inner border border-border bg-surface px-2 text-[0.78rem] text-text outline-none focus:border-brand-500"
    />
  );
}

export function DispatchQueueTable() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [amountOverrides, setAmountOverrides] = useState<Record<number, string>>({});
  const [balanceProvider] = useState<ShipmentProvider>("STEADFAST");
  const [bulkProvider, setBulkProvider] = useState<ShipmentProvider>("STEADFAST");
  const [detailRow, setDetailRow] = useState<OrderDetailModalRow | null>(null);
  // Single-row target xor "bulk" (current `selected` set) — one
  // ConfirmDialog covers both the per-row trash icon and the toolbar's
  // Delete button, same pattern as Order Manager's own delete flow.
  const [deleteTarget, setDeleteTarget] = useState<ShipmentQueueRow | "bulk" | null>(null);

  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useShipmentQueue({ page, pageSize, search });
  const balance = useCourierBalance(balanceProvider);
  const dispatch = useDispatchShipment();
  const dispatchBulk = useDispatchBulkShipment();
  const track = useTrackShipment();
  const cancel = useCancelShipment();
  // A dispatch-queue row IS an order — deleting one here means the exact
  // same soft-delete Order Manager's own Delete does (moves it to this
  // page's "Deleted Orders" tab, same underlying Order.deletedAt, nothing
  // purged). Reuses that hook/endpoint rather than a second delete path.
  const bulkOrderAction = useBulkOrderAction();

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  function toggleOne(id: number) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }
  function toggleAll() {
    setSelected(selected.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function sendOne(row: ShipmentQueueRow) {
    const override = amountOverrides[row.id];
    dispatch.mutate({
      orderId: row.id,
      provider: bulkProvider,
      codAmountOverride: override !== undefined && override !== "" ? Number(override) : undefined,
    });
  }

  function sendSelected() {
    if (selected.size === 0) return;
    dispatchBulk.mutate(
      { orderIds: [...selected], provider: bulkProvider },
      { onSuccess: () => setSelected(new Set()) },
    );
  }

  function printSelected(type: "invoice" | "label") {
    if (selected.size === 0) return;
    const path = type === "invoice" ? "/print/orders/bulk-invoice" : "/print/orders/bulk-label";
    window.open(`${path}?ids=${[...selected].join(",")}`, "_blank");
  }

  function confirmDelete() {
    const orderIds = deleteTarget === "bulk" ? [...selected] : deleteTarget ? [deleteTarget.id] : [];
    if (orderIds.length === 0) return;
    bulkOrderAction.mutate(
      { orderIds, action: "delete" },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["admin-shipments"] });
          setSelected(new Set());
          setDeleteTarget(null);
        },
      },
    );
  }

  return (
    <div className="rounded-card border border-border bg-surface p-[18px_18px_14px] shadow-card">
      <div className="flex flex-wrap items-center gap-2.5">
        <select
          value={bulkProvider}
          onChange={(e) => setBulkProvider(e.target.value as ShipmentProvider)}
          className="h-[38px] rounded-inner border border-border bg-surface px-2.5 text-[0.75rem] font-semibold text-secondary outline-none"
        >
          <option value="STEADFAST">Steadfast</option>
          <option value="PATHAO">Pathao</option>
          <option value="REDX">RedX</option>
        </select>
        <button
          type="button"
          disabled={selected.size === 0 || dispatchBulk.isPending}
          onClick={sendSelected}
          className="h-[38px] rounded-inner bg-brand-500 px-3 text-[0.76rem] font-bold text-white hover:bg-brand-600 disabled:opacity-40"
        >
          {dispatchBulk.isPending ? "Sending…" : `Send selected (${selected.size})`}
        </button>
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => printSelected("invoice")}
          className="h-[38px] rounded-inner border border-border px-3 text-[0.76rem] font-bold text-text hover:bg-surface-2 disabled:opacity-40"
        >
          Print invoices
        </button>
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => printSelected("label")}
          className="h-[38px] rounded-inner border border-border px-3 text-[0.76rem] font-bold text-text hover:bg-surface-2 disabled:opacity-40"
        >
          Print labels
        </button>
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => setDeleteTarget("bulk")}
          className="h-[38px] rounded-inner border border-danger/30 bg-danger/5 px-3 text-[0.76rem] font-bold text-danger hover:bg-danger/10 disabled:opacity-40"
        >
          Delete selected
        </button>

        <input
          type="text"
          placeholder="Search order # or phone…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setSearch(searchInput);
              setPage(1);
            }
          }}
          className="h-[38px] w-[220px] rounded-inner border border-border bg-surface px-3 text-[0.76rem] text-text outline-none focus:border-brand-500"
        />

        <div className="ml-auto flex items-center gap-2.5">
          <div className="flex h-[38px] items-center gap-1.5 rounded-inner border border-border px-3 text-[0.76rem] font-bold text-text">
            <span className="text-muted">Steadfast balance:</span>
            {balance.isLoading ? (
              <span>…</span>
            ) : balance.data && !balance.data.unavailable ? (
              <span className="text-success">৳{balance.data.balance}</span>
            ) : (
              <span className="text-muted">unavailable</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-[38px] rounded-inner border border-border px-3 text-[0.76rem] font-bold text-text hover:bg-surface-2"
          >
            {isFetching ? "Reloading…" : "Reload"}
          </button>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="w-[34px] rounded-l-[8px] bg-[#f7f9fc] px-2.5 py-[11px]">
                <input type="checkbox" checked={rows.length > 0 && selected.size === rows.length} onChange={toggleAll} className="h-4 w-4 accent-brand-500" />
              </th>
              {["Order", "Date", "Status", "Fraud Check", "Amount", "Send", "Print", "Consignment ID", "Delivery Status"].map((h) => (
                <th key={h} className="whitespace-nowrap bg-[#f7f9fc] px-2.5 py-[11px] text-left text-[0.73rem] font-bold text-secondary">
                  {h}
                </th>
              ))}
              <th className="whitespace-nowrap bg-[#f7f9fc] px-2.5 py-[11px] text-left text-[0.73rem] font-bold text-secondary">Total</th>
              <th className="rounded-r-[8px] whitespace-nowrap bg-[#f7f9fc] px-2.5 py-[11px] text-left text-[0.73rem] font-bold text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-2.5 py-8 text-center text-sm text-muted">
                  No orders match these filters.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[#f1f5fa] last:border-b-0 hover:bg-[#fafcfe]">
                <td className="px-2.5 py-3 align-middle">
                  <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleOne(row.id)} className="h-4 w-4 accent-brand-500" />
                </td>
                <td className="px-2.5 py-3 align-middle whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() =>
                      setDetailRow({ id: row.id, orderNumber: row.orderNumber, shipmentId: row.shipment?.id ?? null, shippingPhone: row.shippingPhone })
                    }
                    className="font-bold text-brand-500 hover:underline"
                  >
                    {row.orderNumber}
                  </button>
                  {row.recipientName && <div className="text-[0.7rem] text-muted">{row.recipientName}</div>}
                </td>
                <td className="px-2.5 py-3 align-middle whitespace-nowrap text-[0.78rem] text-text">
                  {new Date(row.createdAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                </td>
                <td className="px-2.5 py-3 align-middle">
                  <Pill className={ORDER_STATUS_PILL[row.status as unknown as string] ?? "bg-surface-2 text-secondary"}>
                    {row.status as unknown as string}
                  </Pill>
                </td>
                <td className="px-2.5 py-3 align-middle">
                  <FraudCheckCell phone={row.shippingPhone} />
                </td>
                <td className="px-2.5 py-3 align-middle">
                  <AmountCell
                    row={row}
                    value={amountOverrides[row.id] ?? row.pendingCodAmount ?? ""}
                    onChange={(v) => setAmountOverrides((prev) => ({ ...prev, [row.id]: v }))}
                  />
                </td>
                <td className="px-2.5 py-3 align-middle whitespace-nowrap">
                  {row.shipment ? (
                    <div className="flex items-center gap-1">
                      <Pill className="bg-[#e3f7ee] text-[#16a06d]">Sent</Pill>
                      <button
                        type="button"
                        title="Refresh tracking from courier"
                        disabled={track.isPending}
                        onClick={() => track.mutate(row.shipment!.id)}
                        className="rounded-[6px] px-1.5 py-0.5 text-[0.68rem] font-bold text-brand-500 hover:bg-brand-50"
                      >
                        Refresh
                      </button>
                      <button
                        type="button"
                        title="Cancel shipment"
                        disabled={cancel.isPending}
                        onClick={() => {
                          const reasonCode = prompt("Cancellation reason (e.g. customer-requested):");
                          if (reasonCode) cancel.mutate({ id: row.shipment!.id, reasonCode });
                        }}
                        className="rounded-[6px] px-1.5 py-0.5 text-[0.68rem] font-bold text-[#e8465e] hover:bg-[#feeaec]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={dispatch.isPending}
                      onClick={() => sendOne(row)}
                      className="h-8 rounded-inner bg-brand-500 px-3 text-[0.74rem] font-bold text-white hover:bg-brand-600 disabled:opacity-40"
                    >
                      Send
                    </button>
                  )}
                </td>
                <td className="px-2.5 py-3 align-middle whitespace-nowrap">
                  <a href={`/print/orders/${row.id}/invoice`} target="_blank" rel="noreferrer" className="font-bold text-brand-500 hover:underline">
                    Print
                  </a>
                </td>
                <td className="px-2.5 py-3 align-middle whitespace-nowrap text-[0.78rem] text-text">
                  {row.shipment?.consignmentId ?? row.shipment?.trackingCode ?? "—"}
                </td>
                <td className="px-2.5 py-3 align-middle whitespace-nowrap">
                  {row.shipment ? (
                    <Pill className={SHIPMENT_STATUS_PILL[row.shipment.status as unknown as string] ?? "bg-surface-2 text-secondary"}>
                      {SHIPMENT_STATUS_LABEL[row.shipment.status as unknown as string] ?? (row.shipment.status as unknown as string)}
                    </Pill>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-2.5 py-3 align-middle whitespace-nowrap font-bold text-text">৳{row.totalAmount}</td>
                <td className="px-2.5 py-3 align-middle whitespace-nowrap">
                  <button
                    type="button"
                    title="Delete order"
                    onClick={() => setDeleteTarget(row)}
                    className="grid h-8 w-8 place-items-center rounded-inner border border-danger/30 text-danger hover:bg-danger/10"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3.5">
        <div className="text-[0.76rem] font-semibold text-secondary">
          {total === 0 ? "No orders" : `Showing ${start} to ${end} of ${total} orders`}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="grid h-[30px] w-[30px] place-items-center rounded-[8px] border border-border text-text disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="px-2 text-[0.76rem] font-semibold text-secondary">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="grid h-[30px] w-[30px] place-items-center rounded-[8px] border border-border text-text disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-[30px] rounded-[8px] border border-border bg-surface px-2 text-[0.72rem] font-semibold text-secondary outline-none"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} / page
              </option>
            ))}
          </select>
        </div>
      </div>

      {detailRow && <OrderDetailModal row={detailRow} onClose={() => setDetailRow(null)} />}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        pending={bulkOrderAction.isPending}
        title={deleteTarget === "bulk" ? `Delete ${selected.size} order(s)?` : `Delete order #${deleteTarget?.orderNumber}?`}
        description="This moves the order to Deleted Orders, not a permanent delete — it can be restored from there at any time."
      />
    </div>
  );
}
