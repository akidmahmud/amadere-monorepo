"use client";

import { Button } from "@amader/admin-ui";
import type { Attribute } from "@/hooks/useAttributes";
import type { VariantInput } from "@/hooks/useProducts";
import { VariantRowForm } from "./VariantRowForm";

export interface NewVariantsBuilderProps {
  attributes: Attribute[];
  variants: VariantInput[];
  onChange: (variants: VariantInput[]) => void;
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

// Used on the New Product page — the product doesn't exist yet, so variants
// accumulate as plain local state and go out as one array in the create
// request (the one place the backend documents accepting a `variants[]`
// directly). Editing an existing product's variants uses
// ExistingVariantsManager instead, which calls the real add/remove
// endpoints immediately.
export function NewVariantsBuilder({ attributes, variants, onChange }: NewVariantsBuilderProps) {
  return (
    <div>
      <span className="mb-2 block text-xs font-semibold text-secondary">Variants</span>
      {attributes.length === 0 && (
        <p className="text-xs text-muted">Select at least one attribute above to define variants.</p>
      )}
      <div className="mb-2 flex flex-col gap-1.5">
        {variants.map((v, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-text">
            <span className="flex-1">
              {labelFor(attributes, v.attributeValueIds)} — ৳{v.price}
              {v.isDefault && " (default)"}
            </span>
            <Button type="button" variant="link" className="text-danger" onClick={() => onChange(variants.filter((_, j) => j !== i))}>
              Remove
            </Button>
          </div>
        ))}
      </div>
      {attributes.length > 0 && (
        <VariantRowForm attributes={attributes} submitLabel="Add variant" onSubmit={(v) => onChange([...variants, v])} />
      )}
    </div>
  );
}
