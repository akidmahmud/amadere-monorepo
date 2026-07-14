import type { components } from "./api/schema";

type PublicProductDetailDto = components["schemas"]["PublicProductDetailDto"];
type PublicProductVariantDto = components["schemas"]["PublicProductVariantDto"];
// Both the list (PublicProductDto) and detail (PublicProductDetailDto) shapes
// carry an identical `variants` field — accepting just that slice lets these
// helpers work for product cards (list shape) as well as the PDP (detail
// shape) without duplicating this logic.
type ProductWithVariants = Pick<PublicProductDetailDto, "variants">;

export interface PackSizeOptionData {
  value: string;
  label: string;
  price: string;
  originalPrice?: string | null;
  stock: number;
  stockStatus: string;
  badge?: string;
}

function variantLabel(variant: PublicProductVariantDto): string {
  return variant.attributeValues.map((av) => av.value).join(" / ") || variant.sku || `Option ${variant.id}`;
}

// hasVariants products carry no price/stock on the parent row — every pack
// option comes from the variant list instead (same rule as
// toProductCardData's default-variant fallback, extended to the full list).
export function buildPackSizeOptions(product: ProductWithVariants): PackSizeOptionData[] {
  return product.variants.map((variant) => {
    const price = variant.price ?? "0";
    const onSale = variant.salePrice != null && Number(variant.salePrice) < Number(price);
    return {
      value: String(variant.id),
      label: variantLabel(variant),
      price: onSale ? variant.salePrice! : price,
      originalPrice: onSale ? price : undefined,
      stock: variant.stock,
      stockStatus: variant.stockStatus as unknown as string,
      badge: variant.isDefault ? "Best Seller" : undefined,
    };
  });
}

export function defaultVariantId(product: ProductWithVariants): string | undefined {
  const defaultVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0];
  return defaultVariant ? String(defaultVariant.id) : undefined;
}
