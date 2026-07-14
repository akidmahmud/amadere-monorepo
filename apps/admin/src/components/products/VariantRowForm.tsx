"use client";

import { useState } from "react";
import { Button } from "@amader/admin-ui";
import type { Attribute } from "@/hooks/useAttributes";
import type { VariantInput } from "@/hooks/useProducts";

export interface VariantRowFormProps {
  attributes: Attribute[];
  onSubmit: (variant: VariantInput) => void;
  submitLabel: string;
  pending?: boolean;
}

// One attribute-value picker per selected axis (e.g. Size, Color) plus the
// variant's own sku/price/stock — shared between the "build variants before
// the product exists yet" flow (new product) and the "add one more variant"
// flow (existing product), since the row shape is identical either way.
export function VariantRowForm({ attributes, onSubmit, submitLabel, pending }: VariantRowFormProps) {
  const [valueByAttribute, setValueByAttribute] = useState<Record<number, number>>({});
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [stock, setStock] = useState("0");
  const [isDefault, setIsDefault] = useState(false);

  const canSubmit = attributes.length > 0 && attributes.every((a) => valueByAttribute[a.id]) && price;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      sku: sku || undefined,
      price: Number(price),
      salePrice: salePrice ? Number(salePrice) : undefined,
      stock: Number(stock),
      isDefault,
      attributeValueIds: Object.values(valueByAttribute),
    });
    setValueByAttribute({});
    setSku("");
    setPrice("");
    setSalePrice("");
    setStock("0");
    setIsDefault(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-inner bg-surface-2 p-2.5">
      {attributes.map((attr) => (
        <label key={attr.id} className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-secondary">{attr.translations[0]?.name}</span>
          <select
            value={valueByAttribute[attr.id] ?? ""}
            onChange={(e) => setValueByAttribute((prev) => ({ ...prev, [attr.id]: Number(e.target.value) }))}
            className="h-9 rounded-sm border border-border bg-surface px-2 text-xs text-text outline-none focus:border-brand-500"
          >
            <option value="">Select</option>
            {attr.values.map((v) => (
              <option key={v.id} value={v.id}>
                {v.translations[0]?.value}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-secondary">SKU</span>
        <input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="h-9 w-24 rounded-sm border border-border bg-surface px-2 text-xs text-text outline-none focus:border-brand-500"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-secondary">Price</span>
        <input
          type="number"
          required
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="num h-9 w-20 rounded-sm border border-border bg-surface px-2 text-xs text-text outline-none focus:border-brand-500"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-secondary">Sale price</span>
        <input
          type="number"
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
          className="num h-9 w-20 rounded-sm border border-border bg-surface px-2 text-xs text-text outline-none focus:border-brand-500"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-secondary">Stock</span>
        <input
          type="number"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          className="num h-9 w-16 rounded-sm border border-border bg-surface px-2 text-xs text-text outline-none focus:border-brand-500"
        />
      </label>
      <label className="flex items-center gap-1.5 pb-2 text-xs text-text">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        Default
      </label>
      <Button type="submit" variant="ghost" disabled={!canSubmit || pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
