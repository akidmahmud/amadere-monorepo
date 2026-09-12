"use client";

import { useMemo, useState } from "react";
import { Button, Card, Icon } from "@amader/admin-ui";
import {
  OrderDetailModal,
  type OrderDetailModalRow,
} from "@/components/OrderDetailModal";
import {
  recoveryExportUrl,
  useIncompleteOrders,
  useRecoveryRate,
} from "@/hooks/useRecovery";
import { resolveDateRange } from "@/lib/date-range";

const PAGE_SIZE = 20;

// Day / week / month, plus a custom window — the four the shop asked for,
// named the way the rest of Net Profit names them.
const DATE_RANGES = [
  { value: "", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "custom", label: "Custom range" },
] as const;

const money = (v: string | number) =>
  `৳${Number(v).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;

const inputClass =
  "h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

/**
 * The carts that came back — every abandoned cart that turned into a real
 * order, for as far back as the data goes.
 *
 * Reads the same list endpoint as the funnel with `outcome=recovered`, so the
 * count here and the "recovered" figure in the stats strip can never disagree:
 * they are the same query.
 */
export function RecoveredSection() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const range = useMemo(
    () => resolveDateRange(dateRange, dateFrom, dateTo),
    [dateRange, dateFrom, dateTo],
  );

  // One object feeds both the list query and the export URL, so the file can
  // never cover a different set than the screen it was downloaded from.
  const filters = {
    outcome: "recovered" as const,
    q: q.trim() || undefined,
    ...range,
  };

  const { data, isLoading, error } = useIncompleteOrders({
    ...filters,
    page,
    pageSize: PAGE_SIZE,
  });
  const { data: rate } = useRecoveryRate();
  const [openOrder, setOpenOrder] = useState<OrderDetailModalRow | null>(null);

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allOnPageSelected =
    rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Adds/removes only this page, so a selection survives paging through the
  // history instead of being wiped by the next page's header checkbox.
  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });
  }

  function reset() {
    setQ("");
    setDateRange("");
    setDateFrom("");
    setDateTo("");
    setSelected(new Set());
    setPage(1);
  }

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-text">Recovered Orders</h3>
            <p className="text-xs text-secondary">
              Abandoned carts that went on to become orders
              {rate
                ? ` — ${rate.ratePercent}% of carts, ${money(rate.recoveredValue)} recovered`
                : ""}
              .
            </p>
          </div>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, phone or email…"
            className={`${inputClass} w-72`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => {
              setDateRange(e.target.value);
              setPage(1);
            }}
            className={inputClass}
          >
            {DATE_RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>

          {dateRange === "custom" && (
            <>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className={inputClass}
              />
              <span className="text-xs text-secondary">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className={inputClass}
              />
            </>
          )}

          {/* Ticked rows win over the filters — otherwise "Export" beside
              "3 selected" quietly writes the whole history instead. */}
          <a
            href={recoveryExportUrl(filters, [...selected])}
            className="ml-auto inline-flex"
          >
            <Button variant="ghost">
              <Icon name="download" size={16} />
              {selected.size > 0
                ? `Export Selected (${selected.size})`
                : `Export All (${total})`}
            </Button>
          </a>
          <Button variant="ghost" onClick={reset}>
            Reset
          </Button>
        </div>

        {error instanceof Error && (
          <p className="text-xs text-danger">{error.message}</p>
        )}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-surface-2 text-xs text-secondary">
              <tr>
                <th className="w-10 px-4 py-2.5 text-left">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleAllOnPage}
                    aria-label="Select all rows on this page"
                  />
                </th>
                {[
                  "Customer",
                  "Stage abandoned at",
                  "Cart value",
                  "Attempts",
                  "Abandoned",
                  "Recovered as",
                ].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-xs text-secondary"
                  >
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-xs text-secondary"
                  >
                    {q || dateRange
                      ? "No recovered carts match those filters."
                      : "No carts have been recovered yet."}
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      aria-label={`Select ${row.name ?? "guest"}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-text">
                      {row.name ?? "Guest"}
                    </div>
                    {/* Click-to-call, same as the main recovery table: chasing
                        one of these IS a phone call, and staff were having to
                        copy the number out by hand here. */}
                    <div className="text-xs text-secondary">
                      {row.phone ? (
                        <a
                          href={`tel:${row.phone}`}
                          className="font-semibold text-brand-600 hover:underline"
                          title={`Call ${row.phone}`}
                        >
                          {row.phone}
                        </a>
                      ) : (
                        (row.email ?? "No contact details")
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs uppercase text-secondary">
                    {row.stage}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {money(row.subtotal)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-secondary">
                    {row.recoveryAttempts}
                  </td>
                  <td className="px-4 py-3 text-xs text-secondary">
                    {new Date(row.createdAt).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-4 py-3">
                    {row.recoveredOrderId ? (
                      <Button
                        variant="ghost"
                        onClick={() =>
                          // The modal fetches the order itself; these fields are
                          // only what it needs to start. Same modal the Order
                          // Manager opens, so the order is editable from here.
                          setOpenOrder({
                            id: row.recoveredOrderId!,
                            orderNumber: `#${row.recoveredOrderId}`,
                            shipmentId: null,
                            shippingPhone: row.phone,
                          })
                        }
                      >
                        <Icon name="receipt_long" size={16} />
                        View order
                      </Button>
                    ) : (
                      // Marked recovered by the older flow, which did not record
                      // which order it became. Nothing to link to.
                      <span className="text-xs italic text-muted">
                        Order not recorded
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-xs text-secondary">
          <span>
            {total} recovered cart{total === 1 ? "" : "s"}
            {selected.size > 0 ? ` — ${selected.size} selected` : ""}
          </span>
          {pageCount > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span>
                Page {page} of {pageCount}
              </span>
              <Button
                variant="ghost"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>

      {openOrder && (
        <OrderDetailModal row={openOrder} onClose={() => setOpenOrder(null)} />
      )}
    </Card>
  );
}
