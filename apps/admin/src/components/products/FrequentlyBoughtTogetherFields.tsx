"use client";

import { useEffect, useState } from "react";
import { Button, Card, FormSkeleton } from "@amader/admin-ui";
import { usePickerProducts } from "@/hooks/usePickers";
import { useFrequentlyBoughtTogether, useUpdateFrequentlyBoughtTogether } from "@/hooks/useFrequentlyBoughtTogether";
import { SearchPickerField } from "@/components/SearchPickerField";

// Same self-contained sibling-section pattern as CrossSellFields — its own
// query/mutation/save button. Powers the PDP's "Frequently bought together"
// checkbox bundle widget (this product + these picks, customer can
// uncheck any of them before adding all checked items to cart at once).
export function FrequentlyBoughtTogetherFields({ productId }: { productId: number }) {
  const { data: products } = usePickerProducts();
  const { data: current, isLoading } = useFrequentlyBoughtTogether(productId);
  const update = useUpdateFrequentlyBoughtTogether(productId);
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    if (current) setSelected(current);
  }, [current]);

  // Sold-out products are left out of the list -- recommending something
  // nobody can buy is a dead end for the shopper. An already-picked product
  // that has since gone out of stock stays visible, though: dropping it would
  // strip its label off the chip above and leave no way to remove it.
  const options = (products ?? []).filter(
    (p) => p.id !== productId && (!p.outOfStock || selected.includes(p.id)),
  );

  return (
    <Card className="flex max-w-2xl flex-col gap-4">
      <h3 className="font-ui text-sm font-bold text-text">Frequently Bought Together</h3>
      <p className="text-xs text-muted">
        Shown on the product page as a bundle: this product plus the picks below, each with its own checkbox and a
        single "Add to cart" for everything checked.
      </p>

      {isLoading ? (
        <FormSkeleton />
      ) : (
        <>
          <SearchPickerField
            label="Products to bundle with this one"
            options={options}
            selected={selected}
            onChange={setSelected}
            placeholder="Search products..."
          />

          <Button
            type="button"
            variant="primary"
            className="self-start"
            disabled={update.isPending}
            onClick={() => update.mutate(selected)}
          >
            {update.isPending ? "Saving…" : "Save frequently bought together"}
          </Button>
        </>
      )}
    </Card>
  );
}
