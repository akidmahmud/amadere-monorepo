"use client";

import { useProductCardStyle } from "../lib/product-card-style";
import { ProductCard, type ProductCardProps } from "./ProductCard";
import { ProductCardTwo } from "./ProductCardTwo";

export type SiteProductCardProps = ProductCardProps & {
  /** Simple (non-variant) products only — ProductCardTwo-specific, shown in
   * its pack slot in place of a dropdown when there's nothing to pick.
   * Ignored entirely by ProductCard (style ONE). */
  weightLabel?: string;
};

// The one place every product-card call site in apps/web should render
// through, instead of importing ProductCard directly — reads the
// site-wide style setting from context and dispatches to the matching
// component. ProductCardTwo doesn't have a countdown timer (not part of its
// reference design), so `saleEndsAt` is simply not forwarded when style TWO
// is active rather than added there just to keep this prop "used".
export function SiteProductCard(props: SiteProductCardProps) {
  const style = useProductCardStyle();
  if (style === "TWO") {
    const { saleEndsAt: _saleEndsAt, ...rest } = props;
    return <ProductCardTwo {...rest} />;
  }
  return <ProductCard {...props} />;
}
