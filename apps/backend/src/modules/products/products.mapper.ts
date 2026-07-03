import { Locale, Prisma } from '@amader/db';
import { PRODUCT_INCLUDE } from './product-includes';

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof PRODUCT_INCLUDE;
}>;

function decimalToString(
  value: Prisma.Decimal | null | undefined,
): string | null {
  return value ? value.toString() : null;
}

// --- Admin shape: every translation, raw ids, nothing resolved ---

export function toAdminProductDto(product: ProductWithRelations) {
  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    brandId: product.brandId,
    productType: product.productType,
    status: product.status,
    isFeatured: product.isFeatured,
    videoUrl: product.videoUrl,
    hasVariants: product.hasVariants,
    trackInventory: product.trackInventory,
    allowBackorder: product.allowBackorder,
    stock: product.stock,
    stockStatus: product.stockStatus,
    price: decimalToString(product.price),
    salePrice: decimalToString(product.salePrice),
    saleStartsAt: product.saleStartsAt,
    saleEndsAt: product.saleEndsAt,
    costPerItem: decimalToString(product.costPerItem),
    shippableWeight: decimalToString(product.shippableWeight),
    minOrderQuantity: product.minOrderQuantity,
    maxOrderQuantity: product.maxOrderQuantity,
    translations: product.translations.map((t) => ({
      locale: t.locale,
      name: t.name,
      description: t.description,
      content: t.content,
      nutrition: t.nutrition,
      ingredients: t.ingredients,
    })),
    categoryIds: product.categories.map((c) => c.categoryId),
    tagIds: product.tags.map((t) => t.tagId),
    attributeIds: product.attributes.map((a) => a.attributeId),
    media: product.media.map((m) => ({
      id: m.mediaId,
      url: m.media.url,
      isPrimary: m.isPrimary,
      sortOrder: m.sortOrder,
    })),
    variants: product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      barcode: v.barcode,
      price: decimalToString(v.price),
      salePrice: decimalToString(v.salePrice),
      stock: v.stock,
      stockStatus: v.stockStatus,
      weightOverride: decimalToString(v.weightOverride),
      isDefault: v.isDefault,
      attributeValueIds: v.attributeValues.map((av) => av.attributeValueId),
    })),
  };
}

// --- Public shape: resolved to one locale ---

function resolveTranslation<T extends { locale: Locale }>(
  translations: T[],
  locale: Locale,
): T | undefined {
  return translations.find((t) => t.locale === locale) ?? translations[0];
}

export function toPublicProductDto(
  product: ProductWithRelations,
  locale: Locale,
) {
  const translation = resolveTranslation(product.translations, locale);
  const brandTranslation = product.brand
    ? resolveTranslation(product.brand.translations, locale)
    : undefined;

  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    productType: product.productType,
    isFeatured: product.isFeatured,
    videoUrl: product.videoUrl,
    hasVariants: product.hasVariants,
    stock: product.stock,
    stockStatus: product.stockStatus,
    price: decimalToString(product.price),
    salePrice: decimalToString(product.salePrice),
    shippableWeight: decimalToString(product.shippableWeight),
    minOrderQuantity: product.minOrderQuantity,
    maxOrderQuantity: product.maxOrderQuantity,
    name: translation?.name ?? product.slug,
    description: translation?.description ?? null,
    content: translation?.content ?? null,
    nutrition: translation?.nutrition ?? null,
    ingredients: translation?.ingredients ?? null,
    brand: product.brand
      ? {
          id: product.brand.id,
          slug: product.brand.slug,
          name: brandTranslation?.name ?? product.brand.slug,
        }
      : null,
    categories: product.categories.map((c) => {
      const t = resolveTranslation(c.category.translations, locale);
      return {
        id: c.category.id,
        slug: c.category.slug,
        name: t?.name ?? c.category.slug,
      };
    }),
    tags: product.tags.map((pt) => {
      const t = resolveTranslation(pt.tag.translations, locale);
      return { id: pt.tag.id, slug: pt.tag.slug, name: t?.name ?? pt.tag.slug };
    }),
    media: product.media.map((m) => ({
      url: m.media.url,
      type: m.media.type,
      isPrimary: m.isPrimary,
    })),
    variants: product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      price: decimalToString(v.price),
      salePrice: decimalToString(v.salePrice),
      stock: v.stock,
      stockStatus: v.stockStatus,
      isDefault: v.isDefault,
      attributeValues: v.attributeValues.map((av) => {
        const t = resolveTranslation(av.attributeValue.translations, locale);
        return {
          attributeId: av.attributeValue.attributeId,
          attributeValueId: av.attributeValueId,
          value: t?.value ?? '',
          colorHex: av.attributeValue.colorHex,
        };
      }),
    })),
  };
}
