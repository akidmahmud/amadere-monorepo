import { Locale, Prisma, StockStatus } from '@amader/db';

export const WISHLIST_PRODUCT_INCLUDE = {
  product: {
    include: {
      translations: true,
      media: { where: { isPrimary: true }, include: { media: true }, take: 1 },
      // Variant-only products carry no price on the product row itself —
      // same "no price on parent" rule as product-card-mapper.ts's
      // toProductCardData — need the default variant to price/add-to-cart
      // these correctly instead of falling back to null/0.
      variants: true,
    },
  },
} as const;

export type WishlistItemWithProduct = Prisma.WishlistItemGetPayload<{
  include: typeof WISHLIST_PRODUCT_INCLUDE;
}>;

function decimalToString(
  value: Prisma.Decimal | null | undefined,
): string | null {
  return value ? value.toString() : null;
}

export class WishlistItemDto {
  productId!: number;
  slug!: string;
  name!: string;
  price!: string | null;
  salePrice!: string | null;
  stockStatus!: StockStatus;
  image!: string | null;
  addedAt!: Date;
  /** Set only for variant-having products — the default variant's id, so
   * "Add to Cart" from the wishlist can pass a valid variantId instead of a
   * bare productId (which the cart rejects for these products). */
  variantId!: number | null;
}

export function toWishlistItemDto(
  item: WishlistItemWithProduct,
  locale: Locale,
): WishlistItemDto {
  const translation =
    item.product.translations.find((t) => t.locale === locale) ??
    item.product.translations[0];
  const defaultVariant =
    item.product.variants.find((v) => v.isDefault) ?? item.product.variants[0];

  return {
    productId: item.product.id,
    slug: item.product.slug,
    name: translation?.name ?? item.product.slug,
    price: decimalToString(item.product.price) ?? decimalToString(defaultVariant?.price),
    salePrice: decimalToString(item.product.salePrice) ?? decimalToString(defaultVariant?.salePrice),
    stockStatus: item.product.stockStatus,
    image: item.product.media[0]?.media.url ?? null,
    addedAt: item.createdAt,
    variantId: item.product.hasVariants ? (defaultVariant?.id ?? null) : null,
  };
}
