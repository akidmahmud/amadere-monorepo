"use client";

import React from "react";
import { Button } from "@amader/admin-ui";
import { STAGE_LABELS, type IncompleteOrder } from "@/hooks/useRecovery";

const LINE = "#e5ebe6";
const INK = "#1e2b22";
const TEXT = "#374840";
const MUTED = "#64766b";
const FAINT = "#94a69a";
const GREEN = "#2e7d43";
const GREEN_HEADER = "#2f7d33";

export const RECOVERY_OPTIONAL_COLUMNS = ["cartDetails", "stage", "subtotal", "attempts", "lastSeen", "cancelReason"] as const;
export type RecoveryOptionalColumn = (typeof RECOVERY_OPTIONAL_COLUMNS)[number];

export interface RecoveryTableFiltersLike {
  page?: number;
  pageSize?: number;
}

const TH = ({ children, sticky, style }: { children: React.ReactNode; sticky?: 1 | 2; style?: React.CSSProperties }) => (
  <th
    className="sticky top-0 z-[5] px-3 py-3 text-left text-[0.72rem] font-bold whitespace-nowrap text-white"
    style={{
      background: GREEN_HEADER,
      borderRight: "1px solid rgba(255,255,255,.13)",
      ...(sticky === 1 ? { position: "sticky", left: 0, zIndex: 7, width: 42, minWidth: 42 } : {}),
      ...(sticky === 2 ? { position: "sticky", left: 42, zIndex: 7 } : {}),
      ...style,
    }}
  >
    {children}
  </th>
);

function formatDate(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

export function RecoveryTable({
  items,
  total,
  filters,
  onFiltersChange,
  columns,
  selected,
  onToggle,
  onToggleAll,
  onSendSms,
  onCreateOrder,
  onDelete,
  onCancel,
  sendingId,
  deletingId,
  isLoading,
}: {
  items: IncompleteOrder[];
  total: number;
  filters: RecoveryTableFiltersLike;
  onFiltersChange: (next: RecoveryTableFiltersLike) => void;
  columns: Set<RecoveryOptionalColumn>;
  selected: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  onSendSms: (id: number) => void;
  onCreateOrder: (row: IncompleteOrder) => void;
  onDelete: (id: number) => void;
  onCancel: (row: IncompleteOrder) => void;
  sendingId?: number | null;
  deletingId?: number | null;
  isLoading: boolean;
}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const colCount = 4 + columns.size;
  const td = "px-3 py-[11px] text-[0.76rem] font-semibold whitespace-nowrap align-middle border-b";
  const tdStyle = { color: TEXT, borderColor: "#eef3ef", background: "#fff" } as const;

  return (
    <div className="overflow-hidden rounded-card border shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
      <div className="overflow-auto" style={{ maxHeight: "62vh" }}>
        <table className="border-separate border-spacing-0" style={{ minWidth: 1200, width: "100%" }}>
          <thead>
            <tr>
              <TH sticky={1}>
                <input type="checkbox" checked={items.length > 0 && selected.size === items.length} onChange={onToggleAll} className="h-[15px] w-[15px]" style={{ accentColor: GREEN }} />
              </TH>
              <TH sticky={2} style={{ minWidth: 220 }}>
                Customer
              </TH>
              {columns.has("cartDetails") && <TH style={{ minWidth: 240 }}>Cart Items</TH>}
              {columns.has("stage") && <TH>Stage</TH>}
              {columns.has("subtotal") && <TH>Subtotal</TH>}
              {columns.has("lastSeen") && <TH>Last Seen</TH>}
              {columns.has("attempts") && <TH>Attempts</TH>}
              {columns.has("cancelReason") && <TH style={{ minWidth: 200 }}>Cancel Reason</TH>}
              <TH style={{ textAlign: "right" }}>Status / Actions</TH>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={colCount} className="px-3 py-8 text-center text-sm" style={{ color: FAINT }}>
                  Loading abandoned carts…
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-3 py-8 text-center text-sm" style={{ color: FAINT }}>
                  No abandoned carts match these filters.
                </td>
              </tr>
            )}
            {!isLoading &&
              items.map((row) => {
                const isSelected = selected.has(row.id);
                const { date, time } = formatDate(row.lastSeenAt);

                return (
                  <tr key={row.id} className="[&:hover>td]:bg-[#f7fbf8]">
                    <td className={td} style={{ ...tdStyle, position: "sticky", left: 0, zIndex: 6 }} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={isSelected} onChange={() => onToggle(row.id)} className="h-[15px] w-[15px]" style={{ accentColor: GREEN }} />
                    </td>
                    <td className={td} style={{ ...tdStyle, position: "sticky", left: 42, zIndex: 6, boxShadow: "6px 0 8px -6px rgba(20,40,25,.14)" }}>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-[#2e7d43]">{row.name || "Anonymous Shopper"}</span>
                        {row.phone && (
                          <span className="text-[0.72rem] font-semibold" style={{ color: INK }}>
                            {row.phone}
                          </span>
                        )}
                        {row.email && <span className="text-[0.68rem] font-normal" style={{ color: MUTED }}>{row.email}</span>}
                      </div>
                    </td>
                    {columns.has("cartDetails") && (
                      <td className={td} style={tdStyle}>
                        {row.cart.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {row.cart.map((item) => (
                              <div key={item.productId} className="flex items-center gap-1.5" title={`${item.name} (৳${item.unitPrice})`}>
                                {item.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={item.imageUrl} alt={item.name} className="h-8 w-8 rounded-inner border border-border object-cover" />
                                ) : (
                                  <span className="grid h-8 w-8 place-items-center rounded-inner bg-surface-2 text-[10px] text-muted">—</span>
                                )}
                                <div className="flex flex-col leading-tight">
                                  <span className="text-[0.72rem] font-semibold text-text max-w-[140px] truncate">{item.name}</span>
                                  <span className="text-[0.66rem] font-bold" style={{ color: GREEN }}>
                                    {item.quantity} × ৳{item.unitPrice}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                    )}
                    {columns.has("stage") && (
                      <td className={td} style={tdStyle}>
                        <span
                          className={`inline-block rounded-pill px-2.5 py-0.5 text-[0.68rem] font-extrabold uppercase tracking-wide ${
                            row.stage === "otp"
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                              : row.stage === "checkout"
                                ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                                : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-400"
                          }`}
                        >
                          {STAGE_LABELS[row.stage] ?? row.stage}
                        </span>
                      </td>
                    )}
                    {columns.has("subtotal") && (
                      <td className={td} style={{ ...tdStyle, fontWeight: 700, color: INK }}>
                        ৳{Number(row.subtotal).toLocaleString()}
                      </td>
                    )}
                    {columns.has("lastSeen") && (
                      <td className={td} style={tdStyle}>
                        <div>{date}</div>
                        <div className="text-[0.66rem]" style={{ color: FAINT }}>
                          {time}
                        </div>
                      </td>
                    )}
                    {columns.has("attempts") && (
                      <td className={td} style={tdStyle}>
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-secondary">
                          {row.recoveryAttempts}
                        </span>
                      </td>
                    )}
                    {columns.has("cancelReason") && (
                      // whitespace-normal, unlike every other cell: a reason is
                      // free text someone typed, so truncating it to one line
                      // would hide the only part of the row that explains it.
                      <td className={`${td} whitespace-normal`} style={tdStyle}>
                        {row.cancelReason ? (
                          <span title={row.cancelReason}>{row.cancelReason}</span>
                        ) : (
                          <span style={{ color: FAINT }}>—</span>
                        )}
                      </td>
                    )}
                    <td className={td} style={{ ...tdStyle, textAlign: "right" }}>
                      {row.recovered ? (
                        <span className="inline-flex items-center gap-1 rounded-pill bg-success/10 px-3 py-1 text-[0.72rem] font-bold text-success">
                          ✓ Recovered (Order #{row.recoveredOrderId})
                        </span>
                      ) : row.canceledAt ? (
                        // A cancelled cart keeps its row (the reason is the
                        // point) but loses every action: chasing it is exactly
                        // what staff just decided not to do.
                        <span
                          className="inline-flex items-center gap-1 rounded-pill px-3 py-1 text-[0.72rem] font-bold"
                          style={{ background: "#f3f4f6", color: "#6b7280" }}
                          title={row.cancelReason ?? undefined}
                        >
                          ✕ Cancelled
                        </span>
                      ) : (
                        <div className="flex justify-end items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={sendingId === row.id || !row.phone}
                            onClick={() => onSendSms(row.id)}
                            className="h-8 text-[0.72rem] font-bold"
                          >
                            {sendingId === row.id ? "Sending…" : "Send SMS"}
                          </Button>
                          <button
                            type="button"
                            onClick={() => onCreateOrder(row)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[0.72rem] font-bold text-white shadow-sm transition-colors"
                            style={{ background: GREEN }}
                          >
                            Create Order
                          </button>
                          <button
                            type="button"
                            onClick={() => onCancel(row)}
                            className="inline-flex h-8 items-center rounded-[8px] border px-3 text-[0.72rem] font-bold transition-colors hover:bg-surface-2"
                            style={{ borderColor: LINE, color: "#6b7280" }}
                            title="Cancel this cart and record why"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === row.id}
                            onClick={() => onDelete(row.id)}
                            className="grid h-8 w-8 place-items-center rounded-[8px] border text-[#e5484d] transition-colors duration-150 hover:bg-[#e5484d] hover:text-white disabled:opacity-40"
                            style={{ borderColor: "#f8ccd3" }}
                            title="Delete abandoned cart"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" />
                              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3.5 border-t p-[13px_18px]" style={{ borderColor: LINE }}>
        <div className="text-[0.76rem] font-semibold" style={{ color: MUTED }}>
          {total === 0 ? "No abandoned carts" : `Showing ${start} to ${end} of ${total} abandoned carts`}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onFiltersChange({ ...filters, page: page - 1 })}
            className="grid h-[30px] w-[30px] place-items-center rounded-[8px] border disabled:opacity-40"
            style={{ borderColor: LINE, color: TEXT }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
            .reduce<number[]>((acc, n) => {
              if (acc.length && n - acc[acc.length - 1] > 1) acc.push(-1);
              acc.push(n);
              return acc;
            }, [])
            .map((n, i) =>
              n === -1 ? (
                <span key={`dots-${i}`} className="px-1 text-[0.74rem]" style={{ color: FAINT }}>
                  …
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  onClick={() => onFiltersChange({ ...filters, page: n })}
                  className="h-[30px] min-w-[30px] rounded-[8px] border px-2 text-[0.74rem] font-bold"
                  style={n === page ? { background: GREEN, borderColor: GREEN, color: "#fff" } : { borderColor: LINE, color: TEXT }}
                >
                  {n}
                </button>
              ),
            )}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onFiltersChange({ ...filters, page: page + 1 })}
            className="grid h-[30px] w-[30px] place-items-center rounded-[8px] border disabled:opacity-40"
            style={{ borderColor: LINE, color: TEXT }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <select
            value={pageSize}
            onChange={(e) => onFiltersChange({ ...filters, pageSize: Number(e.target.value), page: 1 })}
            className="h-[30px] rounded-[8px] border bg-white px-2 text-[0.72rem] font-semibold outline-none"
            style={{ borderColor: LINE, color: MUTED }}
          >
            {[20, 50, 100].map((s) => (
              <option key={s} value={s}>
                {s} / page
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
