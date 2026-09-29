"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@amader/admin-ui";
import { useToast } from "@/components/ToastProvider";
import { proxyFetch } from "@/lib/api/proxy-client";
import { usePosCatalog, usePosSale } from "@/hooks/usePos";
import { lineKey, taka, type PosProduct } from "@/lib/pos-cart";

type Line = {
  productId: number;
  variantId: number | null;
  name: string;
  variantLabel?: string | null;
  /** Price it sold at; null = a new line (today's store price). */
  soldAt: string | null;
  todayPrice?: string;
  quantity: number;
};
type Preview = {
  subTotal: string;
  discount: string;
  vat: string;
  vatDiscount: string;
  total: string;
  oldTotal: string;
  difference: string;
};

/**
 * Edit a completed POS sale: change quantities, remove items, add products.
 * The server previews the new total; Save moves the stock and refunds or
 * collects the difference on the sale's till account.
 */
export function EditOrderDialog({
  id,
  onClose,
}: {
  id: number;
  onClose: () => void;
}) {
  const { data: s } = usePosSale(id);
  return s ? (
    <Editor key={s.id} sale={s} onClose={onClose} />
  ) : (
    <Shell onClose={onClose}>
      <p className="py-10 text-center text-gray-500">Loading…</p>
    </Shell>
  );
}

function Shell({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Edit order"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function Editor({
  sale,
  onClose,
}: {
  sale: NonNullable<ReturnType<typeof usePosSale>["data"]>;
  onClose: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [lines, setLines] = useState<Line[]>(() =>
    sale.items.map((i) => ({
      productId: i.productId!,
      variantId: i.variantId ?? null,
      name: i.productNameSnapshot,
      variantLabel: i.variantLabel,
      soldAt: i.unitPrice,
      quantity: i.quantity,
    })),
  );
  const [q, setQ] = useState("");
  const [reason, setReason] = useState("");
  const { data: found = [], isFetching } = usePosCatalog(
    sale.storeId ?? undefined,
    q.trim(),
    undefined,
    "name",
  );
  const body = lines
    .filter((l) => l.quantity > 0)
    .map((l) => ({
      productId: l.productId,
      variantId: l.variantId,
      quantity: l.quantity,
    }));
  const preview = useQuery({
    queryKey: ["pos-edit-preview", sale.id, body],
    queryFn: () =>
      proxyFetch<Preview>(`/admin/pos/sales/${sale.id}/edit`, {
        method: "POST",
        body: JSON.stringify({ items: body, dryRun: true }),
      }),
    enabled: body.length > 0,
    placeholderData: (prev) => prev,
    retry: false,
  });
  const save = useMutation({
    mutationFn: () =>
      proxyFetch<Preview>(`/admin/pos/sales/${sale.id}/edit`, {
        method: "POST",
        body: JSON.stringify({
          items: body,
          reason: reason.trim() || undefined,
        }),
      }),
    onSuccess: (r) => {
      for (const k of [
        "pos-sale",
        "pos-orders",
        "pos-catalog",
        "pos-stats",
        "pos-recent",
        "pos-customer-list",
      ])
        qc.invalidateQueries({ queryKey: [k] });
      const d = Number(r.difference);
      toast.push(
        d > 0
          ? `Saved — collect ${taka(d)} from the customer`
          : d < 0
            ? `Saved — refund ${taka(-d)} to the customer`
            : "Order updated",
        "success",
      );
      onClose();
    },
    onError: (e) => toast.push(e.message),
  });

  const setQty = (k: string, qty: number) =>
    setLines((ls) =>
      ls.map((l) =>
        lineKey(l) === k ? { ...l, quantity: Math.max(0, qty) } : l,
      ),
    );
  const add = (p: PosProduct) => {
    setLines((ls) =>
      ls.some((l) => lineKey(l) === lineKey(p))
        ? ls.map((l) =>
            lineKey(l) === lineKey(p) ? { ...l, quantity: l.quantity + 1 } : l,
          )
        : [
            ...ls,
            {
              productId: p.productId,
              variantId: p.variantId,
              name: p.name,
              variantLabel: p.variantLabel,
              soldAt: null,
              todayPrice: p.salePrice ?? p.price,
              quantity: 1,
            },
          ],
    );
    setQ("");
  };
  const changed = lines.some((l) => {
    const was = sale.items.find(
      (i) =>
        i.productId === l.productId && (i.variantId ?? null) === l.variantId,
    );
    return (was?.quantity ?? 0) !== l.quantity;
  });
  const p = preview.data;
  const diff = Number(p?.difference ?? 0);

  return (
    <Shell onClose={onClose}>
      <div className="flex items-center gap-3 border-b border-gray-100 p-5">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-50 text-[#1d7a46]">
          <Icon name="edit_note" size={24} />
        </span>
        <div className="flex-1">
          <h2 className="text-lg font-bold">Edit {sale.orderNumber}</h2>
          <p className="text-sm text-gray-500">
            Change quantities, remove items or add products. Items already on
            the sale keep the price they sold at.
          </p>
        </div>
        <button
          className="grid h-9 w-9 place-items-center rounded-lg hover:bg-gray-100"
          onClick={onClose}
          aria-label="Close"
        >
          <Icon name="close" size={20} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <div className="relative">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-gray-200 px-3 focus-within:border-[#1d7a46]">
            <Icon name="search" size={20} className="text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Add a product — search name, SKU or barcode"
              className="flex-1 bg-transparent text-sm outline-none"
              aria-label="Add a product"
            />
          </label>
          {q.trim().length >= 2 && (
            <div className="absolute inset-x-0 top-12 z-10 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
              {found.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-500">
                  {isFetching ? "Searching…" : "No match"}
                </div>
              )}
              {found.slice(0, 20).map((f) => (
                <button
                  key={lineKey(f)}
                  onClick={() => add(f)}
                  disabled={f.stock <= 0}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-emerald-50 disabled:opacity-40"
                >
                  <span>
                    {f.name}
                    {f.variantLabel && (
                      <span className="text-gray-500"> · {f.variantLabel}</span>
                    )}
                  </span>
                  <span className="whitespace-nowrap text-xs text-gray-500">
                    {taka(f.salePrice ?? f.price)} ·{" "}
                    {f.stock >= 9999 ? "in stock" : `${f.stock} left`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
          {lines.map((l) => {
            const k = lineKey(l);
            const price = Number(l.soldAt ?? l.todayPrice ?? 0);
            return (
              <div
                key={k}
                className={`flex items-center gap-3 px-3 py-2.5 ${l.quantity === 0 ? "bg-red-50/60" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate font-semibold ${l.quantity === 0 ? "text-gray-400 line-through" : ""}`}
                  >
                    {l.name}
                    {l.variantLabel && (
                      <span className="font-normal text-gray-500">
                        {" "}
                        · {l.variantLabel}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {taka(price)} each
                    {l.soldAt === null && (
                      <span className="ml-1 rounded bg-emerald-50 px-1.5 font-bold text-[#1d7a46]">
                        new
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center overflow-hidden rounded-lg border border-gray-200">
                  <button
                    className="grid h-9 w-9 place-items-center hover:bg-gray-50 disabled:opacity-30"
                    disabled={l.quantity <= 0}
                    onClick={() => setQty(k, l.quantity - 1)}
                    aria-label={`One less ${l.name}`}
                  >
                    <Icon name="remove" size={18} />
                  </button>
                  <input
                    value={l.quantity}
                    onChange={(e) =>
                      setQty(k, Math.floor(Number(e.target.value)) || 0)
                    }
                    inputMode="numeric"
                    className="w-12 text-center text-sm font-bold outline-none"
                    aria-label={`Quantity of ${l.name}`}
                  />
                  <button
                    className="grid h-9 w-9 place-items-center text-[#1d7a46] hover:bg-emerald-50"
                    onClick={() => setQty(k, l.quantity + 1)}
                    aria-label={`One more ${l.name}`}
                  >
                    <Icon name="add" size={18} />
                  </button>
                </div>
                <span className="w-20 text-right text-sm font-bold">
                  {taka(price * l.quantity)}
                </span>
                <button
                  className="grid h-8 w-8 place-items-center rounded-lg text-red-600 hover:bg-red-50"
                  onClick={() => setQty(k, 0)}
                  aria-label={`Remove ${l.name}`}
                  title="Remove"
                >
                  <Icon name="delete" size={18} />
                </button>
              </div>
            );
          })}
        </div>

        <input
          className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#1d7a46]"
          placeholder="Reason for the change (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        {preview.error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {(preview.error as Error).message}
          </p>
        )}
        {p && body.length > 0 && (
          <div
            className={`space-y-1 rounded-xl bg-gray-50 px-4 py-3 text-sm ${preview.isFetching ? "opacity-50" : ""}`}
            aria-busy={preview.isFetching}
          >
            {preview.isFetching && (
              <div className="text-xs font-semibold text-gray-500">
                Updating…
              </div>
            )}
            <Row label="Subtotal" value={taka(Number(p.subTotal))} />
            {Number(p.discount) > 0 && (
              <Row label="Discount" value={`−${taka(Number(p.discount))}`} />
            )}
            {Number(p.vat) > 0 && (
              <Row label="VAT" value={taka(Number(p.vat))} />
            )}
            {Number(p.vatDiscount) > 0 && (
              <Row
                label="VAT discount"
                value={`−${taka(Number(p.vatDiscount))}`}
              />
            )}
            <Row label="Was" value={taka(Number(p.oldTotal))} muted />
            <Row label="New total" value={taka(Number(p.total))} strong />
            {changed && diff !== 0 && (
              <div
                className={`mt-2 flex justify-between rounded-lg px-3 py-2 font-bold ${diff > 0 ? "bg-emerald-100 text-[#1d7a46]" : "bg-red-100 text-red-700"}`}
              >
                <span>
                  {diff > 0 ? "Collect from customer" : "Refund to customer"}
                </span>
                <span>{taka(Math.abs(diff))}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-gray-100 p-4">
        <button
          className="h-10 rounded-lg border border-gray-200 px-4 text-sm font-semibold"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="h-10 rounded-lg bg-[#1d7a46] px-5 text-sm font-bold text-white hover:bg-[#186a3c] disabled:opacity-40"
          disabled={
            !changed ||
            body.length === 0 ||
            !!preview.error ||
            preview.isFetching ||
            save.isPending
          }
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </Shell>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${strong ? "text-base font-extrabold" : ""} ${muted ? "text-gray-500" : ""}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
