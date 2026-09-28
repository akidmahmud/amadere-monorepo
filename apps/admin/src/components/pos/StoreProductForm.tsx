"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ToastProvider";
import { proxyFetch } from "@/lib/api/proxy-client";
import { usePosCategories } from "@/hooks/usePos";
import { useUploadMedia } from "@/hooks/useMedia";
import { Icon } from "@amader/admin-ui";
import { usePosContext } from "./PosContext";
import { input, primaryBtn } from "./PosSubPage";

export type StoreProductFields = {
  name: string;
  price: string;
  salePrice: string;
  costPerItem: string;
  sku: string;
  barcode: string;
  categoryId: string;
  /** Grams, as typed; stored as kg. Printed on the receipt. */
  weightG: string;
};

export const EMPTY_STORE_PRODUCT: StoreProductFields = {
  name: "",
  price: "",
  salePrice: "",
  costPerItem: "",
  sku: "",
  barcode: "",
  categoryId: "",
  weightG: "",
};

const num = (s: string) => (s.trim() === "" ? null : Number(s));
const label = "flex flex-col gap-1";

/**
 * Create/edit form for a store-only product (POS → Store products, and the
 * "New product" popup on the till). On create, an optional opening stock is
 * posted as a stock-in so the product can be sold straight away.
 */
export function StoreProductForm({
  id,
  initial,
  initialImage = null,
  onDone,
  onCancel,
}: {
  id: number | null;
  initial: StoreProductFields;
  /** The product's current photo when editing. */
  initialImage?: { mediaId: number; url: string } | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { storeId, can } = usePosContext();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: cats = [] } = usePosCategories();
  const [f, setF] = useState(initial);
  const [opening, setOpening] = useState("");
  const [image, setImage] = useState(initialImage);
  const upload = useUploadMedia();
  const set = (k: keyof StoreProductFields, v: string) =>
    setF((x) => ({ ...x, [k]: v }));
  const withStock = id === null && can("pos.stock_in");
  const openingOk =
    opening.trim() === "" ||
    (Number(opening) > 0 && Number.isInteger(Number(opening)));

  const save = useMutation({
    mutationFn: async () => {
      const p = await proxyFetch<{ id: number }>(
        `/admin/pos/products${id ? `/${id}` : ""}?storeId=${storeId}`,
        {
          method: id ? "PUT" : "POST",
          body: JSON.stringify({
            name: f.name,
            price: Number(f.price),
            salePrice: num(f.salePrice),
            costPerItem: num(f.costPerItem),
            sku: f.sku,
            barcode: f.barcode,
            weightKg: f.weightG.trim() ? Number(f.weightG) / 1000 : null,
            categoryId: f.categoryId ? Number(f.categoryId) : null,
            // Create: only when a photo was added. Edit: always (null removes).
            mediaId: id === null ? image?.mediaId : (image?.mediaId ?? null),
          }),
        },
      );
      if (withStock && opening.trim()) {
        await proxyFetch("/admin/stock/stock-in", {
          method: "POST",
          body: JSON.stringify({
            storeId,
            note: "Opening stock (new product)",
            lines: [
              {
                productId: p.id,
                qty: Number(opening),
                unitCost: num(f.costPerItem) ?? undefined,
              },
            ],
          }),
        }).catch((e: Error) => {
          // The product itself saved; say so rather than implying nothing did.
          throw new Error(
            `Product saved, but the opening stock was not: ${e.message}`,
          );
        });
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["pos-products"] });
      qc.invalidateQueries({ queryKey: ["pos-catalog"] });
    },
    onSuccess: () => {
      toast.push("Product saved", "success");
      onDone();
    },
    onError: (e) => toast.push(e.message),
  });

  const valid =
    (f.weightG.trim() === "" || Number(f.weightG) > 0) &&
    f.name.trim() !== "" &&
    f.price !== "" &&
    Number(f.price) >= 0 &&
    openingOk;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex items-center gap-3 sm:col-span-2">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.url}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            <Icon name="image" size={28} className="text-gray-300" />
          )}
        </div>
        <div className="flex flex-col items-start gap-1">
          <label className="cursor-pointer rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold hover:bg-gray-50">
            {upload.isPending
              ? "Uploading…"
              : image
                ? "Change photo"
                : "Add photo (optional)"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={upload.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                upload.mutate(file, {
                  onSuccess: (m) =>
                    setImage({ mediaId: m.id, url: m.cardUrl ?? m.url }),
                  onError: (err) => toast.push(err.message),
                });
              }}
            />
          </label>
          {image && (
            <button
              type="button"
              className="text-xs font-semibold text-gray-500 hover:text-red-600"
              onClick={() => setImage(null)}
            >
              Remove photo
            </button>
          )}
        </div>
      </div>
      <label className={`${label} sm:col-span-2`}>
        <span className="text-xs font-bold">Name *</span>
        <input
          className={input}
          value={f.name}
          onChange={(e) => set("name", e.target.value)}
          autoFocus
        />
      </label>
      {(
        [
          ["price", "Price (৳) *"],
          ["salePrice", "Sale price (৳)"],
          ["costPerItem", "Cost (৳, for profit)"],
        ] as const
      ).map(([k, text]) => (
        <label key={k} className={label}>
          <span className="text-xs font-bold">{text}</span>
          <input
            className={input}
            inputMode="decimal"
            value={f[k]}
            onChange={(e) => set(k, e.target.value)}
          />
        </label>
      ))}
      <label className={label}>
        <span className="text-xs font-bold">Category</span>
        <select
          className={input}
          value={f.categoryId}
          onChange={(e) => set("categoryId", e.target.value)}
        >
          <option value="">None</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        <span className="text-xs font-bold">SKU</span>
        <input
          className={input}
          value={f.sku}
          onChange={(e) => set("sku", e.target.value)}
        />
      </label>
      <label className={label}>
        <span className="text-xs font-bold">
          Barcode (blank = print one from Barcode labels)
        </span>
        <input
          className={input}
          value={f.barcode}
          onChange={(e) => set("barcode", e.target.value)}
        />
      </label>
      <label className={label}>
        <span className="text-xs font-bold">
          Weight in grams (optional, shown on the receipt)
        </span>
        <input
          className={input}
          inputMode="decimal"
          placeholder="e.g. 500"
          value={f.weightG}
          onChange={(e) => set("weightG", e.target.value)}
        />
      </label>
      {withStock && (
        <label className={label}>
          <span className="text-xs font-bold">Opening stock (optional)</span>
          <input
            className={`${input} ${openingOk ? "" : "border-red-400"}`}
            inputMode="numeric"
            placeholder="0"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
          />
        </label>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <button
          className={primaryBtn}
          disabled={!valid || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : "Save"}
        </button>
        <button
          className="h-10 rounded-lg border border-gray-200 px-4 text-sm font-semibold"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
