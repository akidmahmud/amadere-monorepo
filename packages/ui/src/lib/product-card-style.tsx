"use client";

import { createContext, useContext, type ReactNode } from "react";

export type ProductCardStyle = "ONE" | "TWO";

const ProductCardStyleContext = createContext<ProductCardStyle>("ONE");

export interface ProductCardStyleProviderProps {
  value: ProductCardStyle;
  children: ReactNode;
}

// Mounted once, high up the tree (apps/web's root layout), seeded from the
// admin-configured `product_card_style` setting fetched server-side — every
// SiteProductCard instance below it picks up the site's chosen style with no
// extra client fetch and no flash of the wrong card on load.
export function ProductCardStyleProvider({ value, children }: ProductCardStyleProviderProps) {
  return <ProductCardStyleContext.Provider value={value}>{children}</ProductCardStyleContext.Provider>;
}

export function useProductCardStyle(): ProductCardStyle {
  return useContext(ProductCardStyleContext);
}
