"use client";

import { useMemo, useState } from "react";
import {
  Button,
  PackSizeSelector,
  PriceTag,
  QtyStepper,
  useCartDrawerStore,
} from "@amader/ui";
import { buildPackSizeOptions, defaultVariantId } from "@/lib/pdp";
import type { components } from "@/lib/api/schema";

type PublicProductDetailDto = components["schemas"]["PublicProductDetailDto"];

export function PdpPurchasePanel({ product }: { product: PublicProductDetailDto }) {
  const packOptions = useMemo(() => buildPackSizeOptions(product), [product]);
  const [selectedVariantId, setSelectedVariantId] = useState(() => defaultVariantId(product));
  const [qty, setQty] = useState(product.minOrderQuantity || 1);
  const openCartDrawer = useCartDrawerStore((s) => s.open);

  const selectedVariant = product.hasVariants
    ? product.variants.find((v) => String(v.id) === selectedVariantId)
    : undefined;

  const price = product.hasVariants
    ? (packOptions.find((p) => p.value === selectedVariantId)?.price ?? "0")
    : (product.salePrice ?? product.price ?? "0");
  const originalPrice = product.hasVariants
    ? packOptions.find((p) => p.value === selectedVariantId)?.originalPrice
    : product.salePrice && Number(product.salePrice) < Number(product.price ?? 0)
      ? product.price
      : undefined;

  const stockStatus = selectedVariant ? selectedVariant.stockStatus : product.stockStatus;
  const outOfStock = (stockStatus as unknown as string) === "OUT_OF_STOCK";

  // TODO(F6): wire to POST /cart/items with real guest-token persistence +
  // TanStack Query cache sync — that infrastructure is F6's job (AGENTS.web.md
  // §7). For now, opening the drawer is the honest amount of feedback a PDP
  // action should give without half-building F6's cart state management.
  function handleAddToCart() {
    openCartDrawer();
  }

  return (
    <div>
      <PriceTag price={price} originalPrice={originalPrice} align="left" size="lg" className="mb-4" />

      {product.hasVariants && packOptions.length > 0 && selectedVariantId && (
        <>
          <h4 className="mb-2.5 font-ui text-sm font-medium text-ink">Select Pack Size</h4>
          <PackSizeSelector options={packOptions} value={selectedVariantId} onChange={setSelectedVariantId} />
        </>
      )}

      {outOfStock ? (
        <p className="mb-4 font-ui text-sm font-semibold text-red-600">Out of Stock</p>
      ) : (
        (stockStatus as unknown as string) === "ON_BACKORDER" && (
          <p className="mb-4 font-ui text-sm text-gold-dark">Available on backorder</p>
        )
      )}

      <div className="mb-6 flex items-center gap-3">
        <QtyStepper
          value={qty}
          onChange={setQty}
          min={product.minOrderQuantity || 1}
          max={product.maxOrderQuantity ?? undefined}
        />
        <Button variant="ghost" disabled={outOfStock} onClick={handleAddToCart}>
          Add to Cart
        </Button>
        <Button variant="green" disabled={outOfStock} onClick={handleAddToCart}>
          Buy Now
        </Button>
      </div>
    </div>
  );
}
