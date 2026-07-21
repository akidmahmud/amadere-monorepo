"use client";

import { useState } from "react";
import { Button } from "@amader/admin-ui";
import type { Attribute } from "@/hooks/useAttributes";
import { PRODUCTS_KEY, useAddVariant, useRemoveVariant, useUpdateVariantSku, type AdminProductVariant } from "@/hooks/useProducts";
import { useUpdateVariantPrice } from "@/hooks/useProfit";
import { useUpdateInventoryStock } from "@/hooks/useInventory";
import { useQueryClient } from "@tanstack/react-query";
import { VariantRowForm } from "./VariantRowForm";

export interface ExistingVariantsManagerProps {
  productId: number;
  attributes: Attribute[];
  variants: AdminProductVariant[];
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

// Inline price/stock editor for one existing variant row — hits the same
// PATCH endpoints Net Profit's Inventory tab (stock) and Profit page (price)
// already use, just invalidating this page's own product query afterward so
// the row reflects the save immediately.
function VariantEditRow({
  productId,
  variant,
  attributes,
}: {
  productId: number;
  variant: AdminProductVariant;
  attributes: Attribute[];
}) {
  const qc = useQueryClient();
  const updatePrice = useUpdateVariantPrice(productId);
  const updateStock = useUpdateInventoryStock();
  const updateSku = useUpdateVariantSku(productId);
  const [price, setPrice] = useState(String(variant.price));
  const [salePrice, setSalePrice] = useState(variant.salePrice != null ? String(variant.salePrice) : "");
  const [stock, setStock] = useState(String(variant.stock));
  const [sku, setSku] = useState(variant.sku ?? "");

  const dirty =
    price !== String(variant.price) ||
    salePrice !== (variant.salePrice != null ? String(variant.salePrice) : "") ||
    stock !== String(variant.stock) ||
    sku !== (variant.sku ?? "");
  const pending = updatePrice.isPending || updateStock.isPending || updateSku.isPending;

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
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-inner bg-surface-2 p-2.5">
      <span className="mb-1.5 min-w-0 flex-1 text-sm text-text">
        {labelFor(attributes, variant.attributeValueIds) || `Variant #${variant.id}`}
        {variant.isDefault && " (default)"}
      </span>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-secondary">SKU</span>
        <input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="h-8 w-32 rounded-sm border border-border bg-surface px-2 text-xs text-text outline-none focus:border-brand-500"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-secondary">Price</span>
        <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={editInputClass} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-secondary">Sale price</span>
        <input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className={editInputClass} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-secondary">Stock</span>
        <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className={editInputClass} />
      </label>
      <Button type="button" variant="ghost" disabled={!dirty || pending} onClick={save}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {updateSku.isError && (
        <span className="w-full text-xs text-danger">
          {updateSku.error instanceof Error ? updateSku.error.message : "Failed to save SKU"}
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
export function ExistingVariantsManager({ productId, attributes, variants }: ExistingVariantsManagerProps) {
  const addVariant = useAddVariant(productId);
  const removeVariant = useRemoveVariant(productId);

  return (
    <div>
      <span className="mb-2 block text-xs font-semibold text-secondary">Variants</span>
      <div className="mb-2 flex flex-col gap-1.5">
        {variants.map((v) => (
          <div key={v.id} className="flex items-start gap-2">
            <div className="flex-1">
              <VariantEditRow productId={productId} variant={v} attributes={attributes} />
            </div>
            <Button type="button" variant="link" className="mt-2 text-danger" onClick={() => removeVariant.mutate(v.id)}>
              Remove
            </Button>
          </div>
        ))}
        {variants.length === 0 && <p className="text-xs text-muted">No variants yet.</p>}
      </div>
      {attributes.length > 0 ? (
        <VariantRowForm
          attributes={attributes}
          submitLabel={addVariant.isPending ? "Adding…" : "Add variant"}
          pending={addVariant.isPending}
          onSubmit={(v) => addVariant.mutate(v)}
        />
      ) : (
        <p className="text-xs text-muted">Select at least one attribute above to add variants.</p>
      )}
    </div>
  );
}
