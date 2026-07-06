import { Locale, Prisma, StockStatus } from '@amader/db';

export const WISHLIST_PRODUCT_INCLUDE = {
  product: {
    include: {
      translations: true,
      media: { where: { isPrimary: true }, include: { media: true }, take: 1 },
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
}

export function toWishlistItemDto(
  item: WishlistItemWithProduct,
  locale: Locale,
): WishlistItemDto {
  const translation =
    item.product.translations.find((t) => t.locale === locale) ??
    item.product.translations[0];

  return {
    productId: item.product.id,
    slug: item.product.slug,
    name: translation?.name ?? item.product.slug,
    price: decimalToString(item.product.price),
    salePrice: decimalToString(item.product.salePrice),
    stockStatus: item.product.stockStatus,
    image: item.product.media[0]?.media.url ?? null,
    addedAt: item.createdAt,
  };
}
