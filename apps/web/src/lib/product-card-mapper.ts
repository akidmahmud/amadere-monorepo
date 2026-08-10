import type { components } from "./api/schema";
import { toDisplayImageUrl } from "./media";
import { buildPackSizeOptions, defaultVariantId } from "./pdp";
import { sanitizeHtml } from "./sanitize-html";

type PublicProductDto = components["schemas"]["PublicProductDto"];

// Same swagger enum-erasure as productType/status elsewhere (plain response
// DTO classes lose imported-enum literal types) — PublicProductDto.flagLabel
// comes out as Record<string, never> instead of the real union.
type ProductFlagLabel = "BEST_SELLING" | "NEW_ARRIVAL" | "FEATURED";

// Display text for the storefront's corner "flag" badge — admin-editable
// per product (Product.flagLabel).
const FLAG_LABEL_TEXT: Record<ProductFlagLabel, string> = {
  BEST_SELLING: "Best Selling",
  NEW_ARRIVAL: "New Arrival",
  FEATURED: "Featured",
};

export interface ProductCardData {
  href: string;
  productId: number;
  name: string;
  imageUrl?: string;
  price: string;
  originalPrice?: string;
  flagLabel?: string;
  /** ISO date string, only set while a sale is actually active (see
   * `inSaleWindow` below) — drives ProductCard's live "Offer ends in"
   * countdown. Same start/end-window rule cart pricing already enforces
   * (pricing.service.ts's `effectivePrice`), so the countdown and the
   * discounted price it sits next to never disagree. */
  saleEndsAt?: string;
  packOptions?: { value: string; label: string; price: string; originalPrice?: string; outOfStock?: boolean }[];
  defaultPackValue?: string;
  outOfStock: boolean;
  /** Simple (non-variant) products only — ProductCardTwo's static label in
   * its variant/pack slot when there's nothing to actually pick from.
   * Formatted from the product's required shippableWeight (kg). */
  weightLabel?: string;
}

// Simple-product weight/size display, shown on ProductCardTwo's variant
// slot when there's nothing to pick from — under 1kg reads better in grams
// than as a decimal ("250g" vs "0.25kg").
function formatShippableWeight(kg: string): string | undefined {
  const value = Number(kg);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  if (value < 1) return `${Math.round(value * 1000)}g`;
  const rounded = Math.round(value * 100) / 100;
  return `${rounded % 1 === 0 ? rounded : rounded.toFixed(2)}kg`;
}

// Mirrors the backend's real purchase gate (cart.service.ts's validateLine):
// stock only blocks a purchase when trackInventory is on AND allowBackorder
// is off. Products with trackInventory: false (untracked/unlimited) must
// never show "Out of Stock" just because `stock` happens to read 0 — that's
// a stale/unused number for them, not a real signal.
function isOutOfStock(trackInventory: boolean, allowBackorder: boolean, stock: number): boolean {
  return trackInventory && !allowBackorder && stock < 1;
}

// Variant-only products (hasVariants: true) carry no price on the product
// itself — the default variant's price is what a card actually shows.
export function toProductCardData(product: PublicProductDto): ProductCardData {
  const defaultVariant =
    product.variants.find((v) => v.isDefault) ?? product.variants[0];

  const price = product.price ?? defaultVariant?.price ?? "0";
  const salePrice = product.salePrice ?? defaultVariant?.salePrice ?? null;
  const now = Date.now();
  const inSaleWindow =
    (!product.saleStartsAt || new Date(product.saleStartsAt).getTime() <= now) &&
    (!product.saleEndsAt || new Date(product.saleEndsAt).getTime() >= now);
  const onSale = salePrice != null && Number(salePrice) < Number(price) && inSaleWindow;

  const primaryMedia =
    product.media.find((m) => m.isPrimary) ?? product.media[0];

  // Shown even for a single pack size — disabled in that case (ProductCard
  // handles the disabling) rather than hidden, so the card layout doesn't
  // shift between variant and non-variant products.
  const packOptions =
    product.hasVariants && product.variants.length >= 1
      ? buildPackSizeOptions(product).map((p) => ({
          value: p.value,
          label: p.label,
          price: p.price,
          originalPrice: p.originalPrice ?? undefined,
          outOfStock: isOutOfStock(product.trackInventory, product.allowBackorder, p.stock),
        }))
      : undefined;

  return {
    href: `/products/${product.slug}`,
    productId: product.id,
    name: product.name,
    imageUrl: toDisplayImageUrl(primaryMedia?.url),
    price: onSale ? salePrice! : price,
    originalPrice: onSale ? price : undefined,
    flagLabel: product.flagLabel ? FLAG_LABEL_TEXT[product.flagLabel as unknown as ProductFlagLabel] : undefined,
    saleEndsAt: onSale ? product.saleEndsAt ?? undefined : undefined,
    outOfStock: packOptions
      ? packOptions.every((p) => p.outOfStock)
      : isOutOfStock(product.trackInventory, product.allowBackorder, product.stock),
    packOptions,
    defaultPackValue: packOptions ? defaultVariantId(product) : undefined,
    weightLabel: packOptions ? undefined : formatShippableWeight(product.shippableWeight ?? ""),
  };
}

export interface PromoVideoProductData {
  productId: number;
  slug: string;
  name: string;
  description: string | null;
  price: string;
  originalPrice?: string;
  imageUrl?: string;
  defaultVariantId?: string;
}

// Same price/sale/thumbnail logic as toProductCardData above, plus the
// description text the promo video modal's product panel needs (which the
// plain card grid doesn't show).
export function toPromoVideoProductData(product: PublicProductDto): PromoVideoProductData {
  const defaultVariant =
    product.variants.find((v) => v.isDefault) ?? product.variants[0];

  const price = product.price ?? defaultVariant?.price ?? "0";
  const salePrice = product.salePrice ?? defaultVariant?.salePrice ?? null;
  const onSale = salePrice != null && Number(salePrice) < Number(price);

  const primaryMedia =
    product.media.find((m) => m.isPrimary) ?? product.media[0];

  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    // Sanitized HTML, not plain text — PromoVideoModal renders it via
    // dangerouslySetInnerHTML (was previously rendered as plain text,
    // showing raw `<p><strong>` tags in the modal).
    description: product.description ? sanitizeHtml(product.description) : null,
    price: onSale ? salePrice! : price,
    originalPrice: onSale ? price : undefined,
    imageUrl: toDisplayImageUrl(primaryMedia?.url),
    // Variant-only products reject a bare productId add ("This product
    // requires a variantId") — same defaultVariantId() used by
    // toProductCardData above, so the modal's one-click Add to Cart works
    // the same way a product card's does instead of always 400ing.
    defaultVariantId: product.hasVariants ? defaultVariantId(product) : undefined,
  };
}
