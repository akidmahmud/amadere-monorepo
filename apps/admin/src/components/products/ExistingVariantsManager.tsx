"use client";

import { useState } from "react";
import type { Attribute } from "@/hooks/useAttributes";
import {
  PRODUCTS_KEY,
  useAddVariant,
  useRemoveVariant,
  useUpdateVariantSku,
  useUpdateVariantWeight,
  type AdminProductVariant,
  type CostPriceUnit,
} from "@/hooks/useProducts";
import { useUpdateVariantPrice } from "@/hooks/useProfit";
import { useUpdateInventoryStock } from "@/hooks/useInventory";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ToastProvider";
import { ProxyApiError } from "@/lib/api/proxy-client";
import { computeVariantCost } from "@/lib/variant-cost";
import { VariantRowForm } from "./VariantRowForm";

export interface ExistingVariantsManagerProps {
  productId: number;
  attributes: Attribute[];
  variants: AdminProductVariant[];
  /** Product-wide default cost price — undefined = no cost entered. Flat per-variant unless costPriceUnit is set. */
  costPerItem?: number;
  /** When set, costPerItem is a rate scaled by each variant's own Weight (kg) instead of a flat cost. */
  costPriceUnit?: CostPriceUnit | null;
}

function labelFor(attributes: Attribute[], attributeValueIds: number[]): string {
  return attributeValueIds
    .map((valueId) => {
      for (const attr of attributes) {
        const value = attr.values.find((v) => v.id === valueId);
        if (value) return value.translations[0]?.value;
      }
      return null;
    })
    .filter(Boolean)
    .join(" / ");
}

const editInputClass = "num h-8 w-20 rounded-sm border border-border bg-surface px-2 text-xs text-text outline-none focus:border-brand-500";
// Matches the row's h-8 inputs exactly — the shared Button component's
// smallest variant is h-10, which is what made this row's box look taller
// than its content warranted.
const rowButtonClass =
  "h-8 shrink-0 rounded-sm border px-3 text-xs font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50";

// Inline price/stock editor for one existing variant row — hits the same
// PATCH endpoints Net Profit's Inventory tab (stock) and Profit page (price)
// already use, just invalidating this page's own product query afterward so
// the row reflects the save immediately.
function VariantEditRow({
  productId,
  variant,
  attributes,
  onRemove,
  removePending,
  costPerItem,
  costPriceUnit,
}: {
  productId: number;
  variant: AdminProductVariant;
  attributes: Attribute[];
  onRemove: () => void;
  removePending: boolean;
  costPerItem?: number;
  costPriceUnit?: CostPriceUnit | null;
}) {
  const qc = useQueryClient();
  const updatePrice = useUpdateVariantPrice(productId);
  const updateStock = useUpdateInventoryStock();
  const updateSku = useUpdateVariantSku(productId);
  const updateWeight = useUpdateVariantWeight(productId);
  const [price, setPrice] = useState(String(variant.price));
  const [salePrice, setSalePrice] = useState(variant.salePrice != null ? String(variant.salePrice) : "");
  const [stock, setStock] = useState(String(variant.stock));
  const [sku, setSku] = useState(variant.sku ?? "");
  const [weight, setWeight] = useState(variant.weightOverride ?? "");

  const effectiveCost = computeVariantCost(costPerItem, costPriceUnit, weight ? Number(weight) : undefined);
  const profit = effectiveCost !== undefined && price ? Number(price) - effectiveCost : null;
  const saleProfit = effectiveCost !== undefined && salePrice ? Number(salePrice) - effectiveCost : null;

  const dirty =
    price !== String(variant.price) ||
    salePrice !== (variant.salePrice != null ? String(variant.salePrice) : "") ||
    stock !== String(variant.stock) ||
    sku !== (variant.sku ?? "") ||
    weight !== (variant.weightOverride ?? "");
  const pending = updatePrice.isPending || updateStock.isPending || updateSku.isPending || updateWeight.isPending;

  function save() {
    const invalidate = () => qc.invalidateQueries({ queryKey: PRODUCTS_KEY });
    if (price !== String(variant.price) || salePrice !== (variant.salePrice != null ? String(variant.salePrice) : "")) {
      updatePrice.mutate(
        { variantId: variant.id, price: Number(price), salePrice: salePrice ? Number(salePrice) : undefined },
        { onSuccess: invalidate },
      );
    }
    if (stock !== String(variant.stock)) {
      updateStock.mutate({ productId, variantId: variant.id, stock: Number(stock) }, { onSuccess: invalidate });
    }
    if (sku !== (variant.sku ?? "")) {
      updateSku.mutate({ variantId: variant.id, sku }, { onSuccess: invalidate });
    }
    if (weight !== (variant.weightOverride ?? "")) {
      updateWeight.mutate({ variantId: variant.id, weightOverride: weight ? Number(weight) : null }, { onSuccess: invalidate });
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2.5 rounded-xl border border-emerald-800/15 bg-gradient-to-r from-emerald-50/50 via-white to-amber-50/20 p-3 shadow-xs transition-all hover:border-amber-400/40">
      <span className="mb-1.5 w-28 shrink-0 truncate text-xs font-bold text-emerald-950">
        {labelFor(attributes, variant.attributeValueIds) || `Variant #${variant.id}`}
        {variant.isDefault && <span className="ml-1 text-[10px] font-extrabold text-amber-600">(default)</span>}
      </span>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-bold text-emerald-900/80">SKU</span>
        <input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="h-8 w-32 rounded-lg border border-emerald-800/20 bg-white px-2.5 text-xs font-semibold text-emerald-950 outline-none transition-all focus:border-emerald-600 focus:ring-1 focus:ring-amber-400/30"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-bold text-emerald-900/80">Price</span>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="num h-8 w-20 rounded-lg border border-emerald-800/20 bg-white px-2.5 text-xs font-semibold text-emerald-950 outline-none transition-all focus:border-emerald-600 focus:ring-1 focus:ring-amber-400/30"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-bold text-emerald-900/80">Sale price</span>
        <input
          type="number"
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
          className="num h-8 w-20 rounded-lg border border-emerald-800/20 bg-white px-2.5 text-xs font-semibold text-emerald-950 outline-none transition-all focus:border-emerald-600 focus:ring-1 focus:ring-amber-400/30"
        />
      </label>
      {costPriceUnit && (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-emerald-900/80">Weight (kg)</span>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="num h-8 w-20 rounded-lg border border-emerald-800/20 bg-white px-2.5 text-xs font-semibold text-emerald-950 outline-none transition-all focus:border-emerald-600 focus:ring-1 focus:ring-amber-400/30"
          />
        </label>
      )}
      {costPerItem !== undefined && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-emerald-900/80">Profit</span>
            <span
              className={`flex h-8 w-20 items-center rounded-lg border px-2 text-xs font-extrabold shadow-xs ${
                profit !== null && profit < 0
                  ? "border-rose-300 bg-rose-50 text-rose-700"
                  : "border-amber-400/40 bg-gradient-to-r from-emerald-800 to-emerald-900 text-amber-300 ring-1 ring-amber-400/30"
              }`}
            >
              {profit !== null ? `৳${profit.toFixed(2)}` : "—"}
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-emerald-900/80">Sale profit</span>
            <span
              className={`flex h-8 w-20 items-center rounded-lg border px-2 text-xs font-extrabold shadow-xs ${
                saleProfit !== null && saleProfit < 0
                  ? "border-rose-300 bg-rose-50 text-rose-700"
                  : "border-amber-400/40 bg-gradient-to-r from-emerald-800 to-emerald-900 text-amber-300 ring-1 ring-amber-400/30"
              }`}
            >
              {saleProfit !== null ? `৳${saleProfit.toFixed(2)}` : "—"}
            </span>
          </label>
        </>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-bold text-emerald-900/80">Stock</span>
        <input
          type="number"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          className="num h-8 w-20 rounded-lg border border-emerald-800/20 bg-white px-2.5 text-xs font-semibold text-emerald-950 outline-none transition-all focus:border-emerald-600 focus:ring-1 focus:ring-amber-400/30"
        />
      </label>
      <button
        type="button"
        disabled={!dirty || pending}
        onClick={save}
        className="h-8 shrink-0 rounded-lg bg-gradient-to-r from-emerald-800 to-emerald-900 px-3.5 text-xs font-extrabold text-amber-300 shadow-xs ring-1 ring-amber-400/30 transition-all hover:from-emerald-700 hover:to-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        disabled={removePending}
        onClick={onRemove}
        className="h-8 shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 transition-all hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {removePending ? "Removing…" : "Remove"}
      </button>
      {updateSku.isError && (
        <span className="w-full text-xs font-bold text-rose-600">
          {updateSku.error instanceof Error ? updateSku.error.message : "Failed to save SKU"}
        </span>
      )}
      {updateWeight.isError && (
        <span className="w-full text-xs font-bold text-rose-600">
          {updateWeight.error instanceof Error ? updateWeight.error.message : "Failed to save weight"}
        </span>
      )}
    </div>
  );
}

// No update-variant endpoint exists for attribute-value combos or isDefault
// — changing those means removing the variant and adding it again (both
// mutations fire immediately, same pattern already proven on the Attributes
// page). Price, stock, and SKU DO have real update endpoints (see
// VariantEditRow above), so those are edited in place instead.
export function ExistingVariantsManager({ productId, attributes, variants, costPerItem, costPriceUnit }: ExistingVariantsManagerProps) {
  const toast = useToast();
  const addVariant = useAddVariant(productId);
  const removeVariant = useRemoveVariant(productId);

  function handleRemove(variantId: number) {
    removeVariant.mutate(variantId, {
      onError: (err) => {
        // Most common real cause: the backend deliberately blocks deleting a
        // variant that already has order history (see
        // ProductsService.removeVariant) — that message is already plain
        // English, not a class-validator field error, so it's shown as-is
        // rather than run through friendlyErrorMessage.
        toast.push(err instanceof ProxyApiError ? err.message : "Failed to remove variant", "error");
      },
    });
  }

  return (
    <div>
      <span className="mb-2 block text-xs font-semibold text-secondary">Variants</span>
      <div className="mb-2 flex flex-col gap-1.5">
        {variants.map((v) => (
          <VariantEditRow
            key={v.id}
            productId={productId}
            variant={v}
            attributes={attributes}
            onRemove={() => handleRemove(v.id)}
            removePending={removeVariant.isPending && removeVariant.variables === v.id}
            costPerItem={costPerItem}
            costPriceUnit={costPriceUnit}
          />
        ))}
        {variants.length === 0 && <p className="text-xs text-muted">No variants yet.</p>}
      </div>
      {attributes.length > 0 ? (
        <VariantRowForm
          attributes={attributes}
          submitLabel={addVariant.isPending ? "Adding…" : "Add variant"}
          pending={addVariant.isPending}
          onSubmit={(v) => addVariant.mutate(v)}
          costPerItem={costPerItem}
          costPriceUnit={costPriceUnit}
        />
      ) : (
        <p className="text-xs text-muted">Select at least one attribute above to add variants.</p>
      )}
    </div>
  );
}
