"use client";

import { useMemo, useState } from "react";
import { Button, Card } from "@amader/admin-ui";
import { useVatExceptions, useSetVatException } from "@/hooks/useAccounts";
import { useProducts } from "@/hooks/useProducts";

const LINE = "#e3ece5";
const INK = "#1b2a20";
const FAINT = "#7b8b80";

/**
 * Per-product VAT rates.
 *
 * The store has one VAT rate (Accounts > VAT & Cash Flow). Most products use
 * it; a few are zero-rated or sit on a reduced rate. This tab is the list of
 * those few — a product is listed here if and only if it overrides the store
 * rate.
 *
 * "Remove" is not the same as setting 0. Removing puts the product back on
 * whatever the store rate is now and keeps it there if that rate later
 * changes; 0 pins it at zero-rated regardless. Both are offered explicitly
 * because collapsing them would make one of the two unreachable.
 */
export function VatExceptionTab({ storeRatePercent }: { storeRatePercent: number }) {
  const { data: exceptions, isLoading } = useVatExceptions();
  const save = useSetVatException();

  const [q, setQ] = useState("");
  const [rate, setRate] = useState("0");
  const [picked, setPicked] = useState<{ id: number; name: string } | null>(null);

  // Only searches once there is something to search for — an empty query
  // would pull the first page of the whole catalogue into a picker nobody
  // has started using yet.
  const search = useProducts(q.trim().length >= 2 ? { q: q.trim(), pageSize: 8 } : {});
  const results = q.trim().length >= 2 ? (search.data?.items ?? []) : [];

  const alreadySet = useMemo(
    () => new Set((exceptions ?? []).map((e) => e.productId)),
    [exceptions],
  );

  const rateNum = Number(rate);
  const rateValid = rate.trim() !== "" && Number.isFinite(rateNum) && rateNum >= 0 && rateNum <= 100;

  function add() {
    if (!picked || !rateValid) return;
    save.mutate(
      { productId: picked.id, ratePercent: rateNum },
      {
        onSuccess: () => {
          setPicked(null);
          setQ("");
          setRate("0");
        },
      },
    );
  }

  const inputClass =
    "h-9 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-col gap-1 p-4">
          <h3 className="text-sm font-bold text-text">Add a VAT exception</h3>
          <p className="text-xs text-secondary">
            Products not listed below use the store rate of{" "}
            <strong>{storeRatePercent}%</strong>.
          </p>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-1 flex-col gap-1.5" style={{ minWidth: 260 }}>
              <span className="text-xs font-bold text-text">Product</span>
              {picked ? (
                <div className="flex h-9 items-center justify-between gap-2 rounded-sm border border-border bg-surface-2 px-3">
                  <span className="truncate text-sm text-text">{picked.name}</span>
                  <button
                    type="button"
                    onClick={() => setPicked(null)}
                    className="shrink-0 text-xs font-bold text-secondary hover:text-text"
                  >
                    change
                  </button>
                </div>
              ) : (
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search products by name or SKU…"
                  className={inputClass}
                />
              )}
            </label>

            <label className="flex flex-col gap-1.5" style={{ width: 130 }}>
              <span className="text-xs font-bold text-text">VAT rate (%)</span>
              <input
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                className={inputClass}
              />
            </label>

            <Button
              type="button"
              variant="primary"
              disabled={!picked || !rateValid || save.isPending}
              onClick={add}
            >
              {save.isPending ? "Saving…" : "Add exception"}
            </Button>
          </div>

          {!picked && q.trim().length >= 2 && (
            <div className="mt-2 flex flex-col rounded-sm border border-border">
              {search.isLoading && <p className="p-3 text-xs text-secondary">Searching…</p>}
              {!search.isLoading && results.length === 0 && (
                <p className="p-3 text-xs text-secondary">No products match “{q.trim()}”.</p>
              )}
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPicked({ id: p.id, name: p.name })}
                  className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-surface-2"
                >
                  <span className="truncate text-sm text-text">{p.name}</span>
                  <span className="shrink-0 text-[11px] text-secondary">
                    {alreadySet.has(p.id) ? "already has an exception" : (p.sku ?? "")}
                  </span>
                </button>
              ))}
            </div>
          )}

          {save.isError && (
            <p className="mt-2 text-xs text-danger">
              {save.error instanceof Error ? save.error.message : "Couldn't save that rate"}
            </p>
          )}
        </div>
      </Card>

      <Card>
        <div className="overflow-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                {["Product", "SKU", "VAT rate", ""].map((h, i) => (
                  <th
                    key={h || i}
                    className="border-b px-3 py-2.5 text-left text-[0.7rem] font-bold uppercase tracking-wide"
                    style={{ borderColor: LINE, color: FAINT, background: "#f6faf7" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm" style={{ color: FAINT }}>
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && (exceptions ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm" style={{ color: FAINT }}>
                    No exceptions — every product uses the {storeRatePercent}% store rate.
                  </td>
                </tr>
              )}
              {(exceptions ?? []).map((row) => (
                <ExceptionRow key={row.productId} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ExceptionRow({
  row,
}: {
  row: { productId: number; name: string; slug: string; sku: string | null; ratePercent: string };
}) {
  const save = useSetVatException();
  const [editing, setEditing] = useState(false);
  const [rate, setRate] = useState(row.ratePercent);

  const rateNum = Number(rate);
  const valid = rate.trim() !== "" && Number.isFinite(rateNum) && rateNum >= 0 && rateNum <= 100;
  const td = "border-b px-3 py-2.5 text-sm";
  const tdStyle = { borderColor: LINE, color: INK } as const;

  return (
    <tr>
      <td className={td} style={tdStyle}>
        {row.name}
      </td>
      <td className={td} style={{ ...tdStyle, color: FAINT }}>
        {row.sku ?? "—"}
      </td>
      <td className={td} style={tdStyle}>
        {editing ? (
          <input
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            inputMode="decimal"
            autoFocus
            className="h-8 w-24 rounded-sm border border-border bg-surface px-2 text-sm text-text outline-none focus:border-brand-500"
          />
        ) : (
          <strong>{Number(row.ratePercent)}%</strong>
        )}
      </td>
      <td className={td} style={{ ...tdStyle, textAlign: "right" }}>
        <div className="flex justify-end gap-2">
          {editing ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setRate(row.ratePercent);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={!valid || save.isPending}
                onClick={() =>
                  save.mutate(
                    { productId: row.productId, ratePercent: rateNum },
                    { onSuccess: () => setEditing(false) },
                  )
                }
              >
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={save.isPending}
                onClick={() => {
                  // null, not 0 — this puts the product back on the store
                  // rate and keeps it there if that rate later changes.
                  if (
                    confirm(
                      `Remove the VAT exception for “${row.name}”?\n\nIt will go back to the store rate. This is different from setting 0%, which pins it at zero-rated.`,
                    )
                  ) {
                    save.mutate({ productId: row.productId, ratePercent: null });
                  }
                }}
              >
                Remove
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
