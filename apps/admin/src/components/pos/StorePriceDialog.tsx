"use client";

import { WeightField } from "./WeightField";
import { PosImagePicker, type PickedImage } from "./PosImagePicker";
import { fromBase, toBase, unitFor, type WeightUnit } from "@/lib/pos-weight";
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
  const { storeId, store, can } = usePosContext();
  const toast = useToast();
  const qc = useQueryClient();
  const normalName = p.normalName ?? p.name;
  const [name, setName] = useState(p.storeName ? p.name : "");
  // One SKU for the website and every store: a shared product's needs the
  // website product permission.
  const [sku, setSku] = useState(p.sku ?? "");
  const canSku = p.storeOnly || can("product.update");
  const skuChanged = sku.trim() !== (p.sku ?? "");
  const [price, setPrice] = useState(p.storePrice ? p.price : "");
  const [sale, setSale] = useState(p.storePrice ? (p.salePrice ?? "") : "");
  const startUnit = unitFor(
    Number(p.storeWeightKg ?? p.normalWeightKg ?? 0) || 0.5,
    p.storeWeightKg ? p.storeWeightUnit : p.normalWeightUnit,
  );
  const [weightValue, setWeightValue] = useState(
    p.storeWeightKg ? String(fromBase(Number(p.storeWeightKg), startUnit)) : "",
  );
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(startUnit);
  const [addQty, setAddQty] = useState("");
  // undefined = photo unchanged; null = remove.
  const [image, setImage] = useState<PickedImage | null | undefined>(undefined);
  // Untracked products (stock 9999) have no count to add to.
  const canAddStock = can("pos.stock_in") && p.stock < 9999;

  const save = useMutation({
    mutationFn: async (body: {
      name: string | null;
      price: number | null;
      salePrice: number | null;
      weightKg: number | null;
      weightUnit: WeightUnit | null;
      addQty?: number;
    }) => {
      const { addQty: qty, ...override } = body;
      if (canSku && skuChanged)
        await proxyFetch(
          `/admin/pos/products/${p.productId}/sku?storeId=${storeId}`,
          {
            method: "PUT",
            body: JSON.stringify({ variantId: p.variantId, sku: sku.trim() }),
          },
        );
      if (image !== undefined)
        await proxyFetch(
          `/admin/pos/products/${p.productId}/image?storeId=${storeId}`,
          {
            method: "PUT",
            body: JSON.stringify({ mediaId: image?.mediaId ?? null }),
          },
        );
      await proxyFetch(`/admin/pos/prices?storeId=${storeId}`, {
        method: "PUT",
        body: JSON.stringify({
          productId: p.productId,
          variantId: p.variantId,
          ...override,
        }),
      });
      if (qty)
        await proxyFetch("/admin/stock/stock-in", {
          method: "POST",
          body: JSON.stringify({
            storeId,
            note: "Added from the till",
            lines: [
              {
                productId: p.productId,
                variantId: p.variantId ?? undefined,
                qty,
              },
            ],
          }),
        });
    },
    onSuccess: (_r, body) => {
      qc.invalidateQueries({ queryKey: ["pos-catalog"] });
      qc.invalidateQueries({ queryKey: ["pos-stats"] });
      toast.push(
        body.addQty
          ? `Saved — ${body.addQty} added to stock`
          : !body.name &&
              body.price === null &&
              body.weightKg === null &&
              image === undefined &&
              !skuChanged
            ? "Back to the normal name, price and weight"
            : "Saved for this store",
        "success",
      );
      onClose();
    },
    onError: (e) => toast.push(e.message),
  });

  const n = price.trim() === "" ? null : Number(price);
  const s = sale.trim() === "" ? null : Number(sale);
  const w = weightValue.trim() === "" ? null : Number(weightValue);
  const q = addQty.trim() === "" ? 0 : Number(addQty);
  const valid =
    (n === null || n > 0) &&
    (s === null || (n !== null && s > 0 && s <= n)) &&
    (w === null || w > 0) &&
    Number.isInteger(q) &&
    q >= 0;

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
          <div className="col-span-2">
            <span className="mb-1 block text-xs font-bold">Photo</span>
            <PosImagePicker
              url={image === undefined ? p.imageUrl : image?.url}
              onChange={setImage}
              removeLabel={
                p.storeOnly ? "Remove photo" : "Use the website photo"
              }
              hint={
                p.storeOnly
                  ? undefined
                  : "Shown at this store only; the website keeps its photo."
              }
            />
          </div>
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
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-xs font-bold">
              SKU{" "}
              {!p.storeOnly && (
                <span className="font-normal text-amber-700">
                  — shared: changes it on the website and every store
                </span>
              )}
            </span>
            <input
              className={`${input} font-mono ${canSku ? "" : "bg-gray-50 text-gray-500"}`}
              value={sku}
              placeholder="none"
              maxLength={64}
              disabled={!canSku}
              title={
                canSku
                  ? undefined
                  : "Only staff who can edit website products can change a shared SKU"
              }
              onChange={(e) => setSku(e.target.value)}
              aria-label="SKU"
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
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold">Weight / volume</span>
            <WeightField
              label="Weight at this store"
              value={weightValue}
              unit={weightUnit}
              placeholder={
                p.normalWeightKg
                  ? String(fromBase(Number(p.normalWeightKg), weightUnit))
                  : "none"
              }
              onChange={(v, u) => {
                setWeightValue(v);
                setWeightUnit(u);
              }}
            />
          </label>
          {canAddStock && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold">
                Add stock{" "}
                <span className="font-normal text-gray-500">
                  (now {p.stock})
                </span>
              </span>
              <input
                className={`${input} ${!Number.isInteger(q) || q < 0 ? "border-red-400" : ""}`}
                inputMode="numeric"
                value={addQty}
                placeholder="0"
                onChange={(e) => setAddQty(e.target.value)}
                aria-label="Add stock"
              />
            </label>
          )}
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
              save.mutate({
                name: name.trim() || null,
                price: n,
                salePrice: s,
                weightKg: w === null ? null : toBase(w, weightUnit),
                weightUnit: w === null ? null : weightUnit,
                addQty: q || undefined,
              })
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
          {(p.storePrice || p.storeName || p.storeWeightKg) && (
            <button
              className="ml-auto h-10 px-2 text-sm font-semibold text-gray-500 hover:text-red-600"
              disabled={save.isPending}
              onClick={() =>
                save.mutate({
                  name: null,
                  price: null,
                  salePrice: null,
                  weightKg: null,
                  weightUnit: null,
                })
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
