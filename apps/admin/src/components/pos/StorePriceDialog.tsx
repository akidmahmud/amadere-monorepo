"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ToastProvider";
import { proxyFetch } from "@/lib/api/proxy-client";
import { taka, type PosProduct } from "@/lib/pos-cart";
import { usePosContext } from "./PosContext";
import { input, primaryBtn } from "./PosSubPage";

/**
 * This store's own name / price / offer price for one SKU. Blank = the
 * normal one. The website and other stores keep theirs.
 */
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
  const normalName = p.normalName ?? p.name;
  const [name, setName] = useState(p.storeName ? p.name : "");
  const [price, setPrice] = useState(p.storePrice ? p.price : "");
  const [sale, setSale] = useState(p.storePrice ? (p.salePrice ?? "") : "");

  const save = useMutation({
    mutationFn: (body: {
      name: string | null;
      price: number | null;
      salePrice: number | null;
    }) =>
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
        !body.name && body.price === null
          ? "Back to the normal name and price"
          : "Saved for this store",
        "success",
      );
      onClose();
    },
    onError: (e) => toast.push(e.message),
  });

  const n = price.trim() === "" ? null : Number(price);
  const s = sale.trim() === "" ? null : Number(sale);
  const valid =
    (n === null || n > 0) && (s === null || (n !== null && s > 0 && s <= n));

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Store price"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold">At {store?.name} only</h2>
        <p className="mb-4 text-sm text-gray-600">
          {normalName}
          {p.variantLabel ? ` (${p.variantLabel})` : ""}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-xs font-bold">Name at this store</span>
            <input
              className={input}
              value={name}
              placeholder={normalName}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold">Price (৳)</span>
            <input
              className={input}
              inputMode="decimal"
              value={price}
              placeholder={String(Number(p.normalPrice ?? p.price))}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold">Offer price (৳)</span>
            <input
              className={`${input} ${s !== null && (n === null || s > n) ? "border-red-400" : ""}`}
              inputMode="decimal"
              placeholder="none"
              value={sale}
              onChange={(e) => setSale(e.target.value)}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Leave a box blank to use the normal one (price{" "}
          {taka(p.normalPrice ?? p.price)}
          {p.normalSalePrice && <>, offer {taka(p.normalSalePrice)}</>}). Only
          this store changes; the website and other stores keep theirs.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className={primaryBtn}
            disabled={!valid || save.isPending}
            onClick={() =>
              save.mutate({ name: name.trim() || null, price: n, salePrice: s })
            }
          >
            Save
          </button>
          <button
            className="h-10 rounded-lg border border-gray-200 px-4 text-sm font-semibold"
            onClick={onClose}
          >
            Cancel
          </button>
          {(p.storePrice || p.storeName) && (
            <button
              className="ml-auto h-10 px-2 text-sm font-semibold text-gray-500 hover:text-red-600"
              disabled={save.isPending}
              onClick={() =>
                save.mutate({ name: null, price: null, salePrice: null })
              }
            >
              Reset to normal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
