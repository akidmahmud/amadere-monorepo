"use client";

import { Button } from "@amader/admin-ui";
import type { Attribute } from "@/hooks/useAttributes";
import { useAddVariant, useRemoveVariant, type AdminProductVariant } from "@/hooks/useProducts";
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

// No update-variant endpoint exists on the backend — changing a variant's
// price/stock/etc means removing it and adding it again. Both mutations
// fire immediately (not batched into the parent form's submit), same
// pattern already proven on the Attributes page for attribute values.
export function ExistingVariantsManager({ productId, attributes, variants }: ExistingVariantsManagerProps) {
  const addVariant = useAddVariant(productId);
  const removeVariant = useRemoveVariant(productId);

  return (
    <div>
      <span className="mb-2 block text-xs font-semibold text-secondary">Variants</span>
      <div className="mb-2 flex flex-col gap-1.5">
        {variants.map((v) => (
          <div key={v.id} className="flex items-center gap-2 text-sm text-text">
            <span className="flex-1">
              {labelFor(attributes, v.attributeValueIds)} — ৳{v.price}
              {v.sku && ` · ${v.sku}`} · stock {v.stock}
              {v.isDefault && " (default)"}
            </span>
            <Button type="button" variant="link" className="text-danger" onClick={() => removeVariant.mutate(v.id)}>
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
