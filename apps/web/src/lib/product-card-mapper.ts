import type { components } from "./api/schema";
import { toDisplayImageUrl } from "./media";

type PublicProductDto = components["schemas"]["PublicProductDto"];

export interface ProductCardData {
  href: string;
  name: string;
  imageUrl?: string;
  price: string;
  originalPrice?: string;
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

  return {
    href: `/products/${product.slug}`,
    name: product.name,
    imageUrl: toDisplayImageUrl(primaryMedia?.url),
    price: onSale ? salePrice! : price,
    originalPrice: onSale ? price : undefined,
  };
}
