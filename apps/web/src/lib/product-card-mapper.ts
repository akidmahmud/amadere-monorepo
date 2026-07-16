import type { components } from "./api/schema";
import { toDisplayImageUrl } from "./media";
import { buildPackSizeOptions, defaultVariantId } from "./pdp";

type PublicProductDto = components["schemas"]["PublicProductDto"];

export interface ProductCardData {
  href: string;
  productId: number;
  name: string;
  imageUrl?: string;
  price: string;
  originalPrice?: string;
  packOptions?: { value: string; label: string; price: string; originalPrice?: string }[];
  defaultPackValue?: string;
}

// Variant-only products (hasVariants: true) carry no price on the product
// itself — the default variant's price is what a card actually shows.
export function toProductCardData(product: PublicProductDto): ProductCardData {
  const defaultVariant =
    product.variants.find((v) => v.isDefault) ?? product.variants[0];

  const price = product.price ?? defaultVariant?.price ?? "0";
  const salePrice = product.salePrice ?? defaultVariant?.salePrice ?? null;
  const onSale = salePrice != null && Number(salePrice) < Number(price);

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
        }))
      : undefined;

  return {
    href: `/products/${product.slug}`,
    productId: product.id,
    name: product.name,
    imageUrl: toDisplayImageUrl(primaryMedia?.url),
    price: onSale ? salePrice! : price,
    originalPrice: onSale ? price : undefined,
    packOptions,
    defaultPackValue: packOptions ? defaultVariantId(product) : undefined,
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
    description: product.description,
    price: onSale ? salePrice! : price,
    originalPrice: onSale ? price : undefined,
    imageUrl: toDisplayImageUrl(primaryMedia?.url),
  };
}
