"use client";

import { useEffect, useState } from "react";
import { Button, Card, FormSkeleton } from "@amader/admin-ui";
import { usePickerProducts } from "@/hooks/usePickers";
import { PickerPrice } from "@/components/PickerPrice";
import { useCrossSell, useUpdateCrossSell } from "@/hooks/useCrossSell";

function toggle(ids: number[], id: number, set: (ids: number[]) => void) {
  set(ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]);
}

// Self-contained sibling section (same pattern as SeoMetaCard): its own
// query/mutation/save button, not wired into the main product form/payload.
export function CrossSellFields({ productId }: { productId: number }) {
  const { data: products } = usePickerProducts();
  const { data: current, isLoading } = useCrossSell(productId);
  const update = useUpdateCrossSell(productId);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (current) setSelected(current);
  }, [current]);

  const options = (products ?? []).filter((p) => p.id !== productId);
  const selectedProducts = options.filter((p) => selected.includes(p.id));
  const filteredProducts = options.filter((p) => p.label.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <Card className="flex max-w-2xl flex-col gap-4">
      <h3 className="font-ui text-sm font-bold text-text">Cross-sell ("You May Also Like")</h3>
      <p className="text-xs text-muted">
        Shown to customers in the cart when this product is added. Pick the products to suggest alongside it.
      </p>

      {isLoading ? (
        <FormSkeleton />
      ) : (
        <>
          {selectedProducts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedProducts.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1.5 rounded-[6px] bg-brand-50 px-2.5 py-1 text-[0.68rem] font-bold text-brand-500">
                  {p.label}
                  <button
                    type="button"
                    onClick={() => toggle(selected, p.id, setSelected)}
                    className="font-extrabold opacity-80 hover:opacity-100"
                    aria-label={`Remove ${p.label}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="h-9 w-full rounded-inner border border-border bg-surface px-2.5 text-[0.74rem] text-text outline-none focus:border-brand-500"
          />
          <div className="flex max-h-[210px] flex-col gap-0.5 overflow-y-auto rounded-inner border border-border p-1.5">
            {filteredProducts.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-[7px] px-1.5 py-1.5 text-[0.74rem] font-semibold text-text hover:bg-surface-2">
                <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(selected, p.id, setSelected)} className="h-3.5 w-3.5 shrink-0 accent-brand-500" />
                <span className="min-w-0 flex-1 truncate">{p.label}</span>
                <PickerPrice price={p.price} salePrice={p.salePrice} />
              </label>
            ))}
            {filteredProducts.length === 0 && <p className="px-1.5 py-2 text-[0.72rem] text-muted">No products match your search.</p>}
          </div>

          <Button
            type="button"
            variant="primary"
            className="self-start"
            disabled={update.isPending}
            onClick={() => update.mutate(selected)}
          >
            {update.isPending ? "Saving…" : "Save cross-sell"}
          </Button>
        </>
      )}
    </Card>
  );
}
