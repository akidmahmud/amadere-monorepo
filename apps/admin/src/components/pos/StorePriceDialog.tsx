"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ToastProvider";
import { proxyFetch } from "@/lib/api/proxy-client";
import { taka, type PosProduct } from "@/lib/pos-cart";
import { usePosContext } from "./PosContext";
import { input, primaryBtn, productLabel } from "./PosSubPage";

/** This store's own price/offer price for one SKU; the website keeps its own. */
export function StorePriceDialog({
  p,
  onClose,
}: {
  p: PosProduct;
  onClose: () => void;
}) {
  const { storeId, store } = usePosContext();
  const toast = useToast();
  const qc = useQueryClient();
  const [price, setPrice] = useState(p.price);
  const [sale, setSale] = useState(p.salePrice ?? "");

  const save = useMutation({
    mutationFn: (body: { price: number | null; salePrice?: number | null }) =>
      proxyFetch(`/admin/pos/prices?storeId=${storeId}`, {
        method: "PUT",
        body: JSON.stringify({
          productId: p.productId,
          variantId: p.variantId,
          ...body,
        }),
      }),
    onSuccess: (_r, body) => {
      qc.invalidateQueries({ queryKey: ["pos-catalog"] });
      toast.push(
        body.price === null ? "Back to the normal price" : "Store price saved",
        "success",
      );
      onClose();
    },
    onError: (e) => toast.push(e.message),
  });

  const n = Number(price);
  const s = sale.trim() === "" ? null : Number(sale);
  const valid =
    price.trim() !== "" && n > 0 && (s === null || (s > 0 && s <= n));

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Store price"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold">Price at {store?.name}</h2>
        <p className="mb-4 text-sm text-gray-600">{productLabel(p)}</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold">Price (৳) *</span>
            <input
              className={input}
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold">Offer price (৳)</span>
            <input
              className={`${input} ${s !== null && s > n ? "border-red-400" : ""}`}
              inputMode="decimal"
              placeholder="none"
              value={sale}
              onChange={(e) => setSale(e.target.value)}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Normal price: {taka(p.normalPrice ?? p.price)}
          {p.normalSalePrice && <> · offer {taka(p.normalSalePrice)}</>}. Only
          this store changes; the website and other stores keep theirs.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className={primaryBtn}
            disabled={!valid || save.isPending}
            onClick={() => save.mutate({ price: n, salePrice: s })}
          >
            Save
          </button>
          <button
            className="h-10 rounded-lg border border-gray-200 px-4 text-sm font-semibold"
            onClick={onClose}
          >
            Cancel
          </button>
          {p.storePrice && (
            <button
              className="ml-auto h-10 px-2 text-sm font-semibold text-gray-500 hover:text-red-600"
              disabled={save.isPending}
              onClick={() => save.mutate({ price: null })}
            >
              Use normal price
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
