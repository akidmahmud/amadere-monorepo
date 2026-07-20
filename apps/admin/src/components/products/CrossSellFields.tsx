"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@amader/admin-ui";
import { usePickerProducts } from "@/hooks/usePickers";
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

  useEffect(() => {
    if (current) setSelected(current);
  }, [current]);

  return (
    <Card className="flex max-w-2xl flex-col gap-4">
      <h3 className="font-ui text-sm font-bold text-text">Cross-sell ("You May Also Like")</h3>
      <p className="text-xs text-muted">
        Shown to customers in the cart when this product is added. Pick the products to suggest alongside it.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {products?.filter((p) => p.id !== productId).map((p) => (
              <label key={p.id} className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-xs text-text">
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={() => toggle(selected, p.id, setSelected)}
                />
                {p.label}
              </label>
            ))}
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
