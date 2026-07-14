"use client";

import { Button } from "@amader/admin-ui";
import { usePickerProducts } from "@/hooks/usePickers";

export interface BundleItem {
  productId: number;
  quantity: number;
}

export interface BundleItemsFieldsProps {
  items: BundleItem[];
  onChange: (items: BundleItem[]) => void;
}

// variantId isn't offered here — Products/variants don't have an admin UI
// yet (Phase 4), so a bundle item is product-level only for now. The
// backend field stays optional and unset, not a data-model change.
export function BundleItemsFields({ items, onChange }: BundleItemsFieldsProps) {
  const { data: products, isLoading } = usePickerProducts();

  function updateItem(i: number, patch: Partial<BundleItem>) {
    onChange(items.map((item, j) => (j === i ? { ...item, ...patch } : item)));
  }

  return (
    <div>
      <span className="mb-2 block text-xs font-semibold text-secondary">Items</span>
      {isLoading && <p className="text-sm text-muted">Loading products…</p>}
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 rounded-inner bg-surface-2 p-2.5">
            <select
              value={item.productId || ""}
              onChange={(e) => updateItem(i, { productId: Number(e.target.value) })}
              className="h-9 flex-1 rounded-sm border border-border bg-surface px-2 text-sm text-text outline-none focus:border-brand-500"
            >
              <option value="">Select a product</option>
              {products?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
              className="num h-9 w-20 rounded-sm border border-border bg-surface px-2 text-sm text-text outline-none focus:border-brand-500"
            />
            <Button type="button" variant="link" className="text-danger" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              Remove
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="ghost" className="mt-2" onClick={() => onChange([...items, { productId: 0, quantity: 1 }])}>
        Add item
      </Button>
    </div>
  );
}
