import { Locale, Prisma } from '@amader/db';
import { toPublicAuthorDto } from '../authors/authors.mapper';
import { PRODUCT_INCLUDE, PRODUCT_LIST_INCLUDE } from './product-includes';
import {
  AdminProductDto,
  AdminProductListItemDto,
  PublicProductDto,
  PublicProductPreviewPageDto,
} from './dto/product-response.dto';

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof PRODUCT_INCLUDE;
}>;

export type ProductListItemWithRelations = Prisma.ProductGetPayload<{
  include: typeof PRODUCT_LIST_INCLUDE;
}>;

function decimalToString(
  value: Prisma.Decimal | null | undefined,
): string | null {
  return value ? value.toString() : null;
}

// --- Admin shape: every translation, raw ids, nothing resolved ---

export function toAdminProductDto(
  product: ProductWithRelations,
): AdminProductDto {
  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    brandId: product.brandId,
    authorId: product.authorId,
    isbn: product.isbn,
    productType: product.productType,
    status: product.status,
    isFeatured: product.isFeatured,
    googleProductCategory: product.googleProductCategory,
    customLabels: product.customLabels,
    excludeFromFeed: product.excludeFromFeed,
    flagLabel: product.flagLabel,
    videoUrl: product.videoUrl,
    hasVariants: product.hasVariants,
    trackInventory: product.trackInventory,
    allowBackorder: product.allowBackorder,
    stock: product.stock,
    reservedStock: product.reservedStock,
    stockStatus: product.stockStatus,
    price: decimalToString(product.price),
    salePrice: decimalToString(product.salePrice),
    saleStartsAt: product.saleStartsAt,
    saleEndsAt: product.saleEndsAt,
    costPerItem: decimalToString(product.costPerItem),
    costPriceUnit: product.costPriceUnit,
    shippableWeight: decimalToString(product.shippableWeight),
    minOrderQuantity: product.minOrderQuantity,
    maxOrderQuantity: product.maxOrderQuantity,
    translations: product.translations.map((t) => ({
      locale: t.locale,
      name: t.name,
      description: t.description,
      content: t.content,
      keyBenefits: t.keyBenefits,
      benefitPoints: t.benefitPoints,
      howToUse: t.howToUse,
      bookEdition: t.bookEdition,
      bookLanguage: t.bookLanguage,
      bookPublisher: t.bookPublisher,
      bookCountry: t.bookCountry,
      faqs: t.faqs.map((f) => ({
        question: f.question,
        answer: f.answer,
        sortOrder: f.sortOrder,
      })),
    })),
    categoryIds: product.categories.map((c) => c.categoryId),
    tagIds: product.tags.map((t) => t.tagId),
    attributeIds: product.attributes.map((a) => a.attributeId),
    media: product.media.map((m) => ({
      id: m.mediaId,
      url: m.media.url,
      cardUrl: m.media.cardUrl,
      fullUrl: m.media.fullUrl,
      altText: m.media.altText,
      isPrimary: m.isPrimary,
      sortOrder: m.sortOrder,
      variantId: m.variantId,
    })),
    variants: product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      barcode: v.barcode,
      price: decimalToString(v.price),
      salePrice: decimalToString(v.salePrice),
      stock: v.stock,
      reservedStock: v.reservedStock,
      stockStatus: v.stockStatus,
      weightOverride: decimalToString(v.weightOverride),
      isDefault: v.isDefault,
      // Admin sees every variant, hidden ones included — that is the point of
      // the flag. Only toPublicProductDto below filters them out.
      isAdminOnly: v.isAdminOnly,
      attributeValueIds: v.attributeValues.map((av) => av.attributeValueId),
    })),
    digitalFileName: product.digitalFileName,
    digitalFileSize: product.digitalFileSize,
    digitalPageCount: product.digitalPageCount,
    digitalPreviewStartPage: product.digitalPreviewStartPage,
    digitalPreviewEndPage: product.digitalPreviewEndPage,
    previewPages: product.previewPages.map((p) => ({
      pageNumber: p.pageNumber,
      imageUrl: p.imageUrl,
    })),
  };
}

// Excludes createdAt/seoScore — same as toAdminProductDto, the list service
// merges those in separately (seoScore needs an extra SeoMeta batch lookup
// that has nothing to do with PRODUCT_LIST_INCLUDE's shape).
export function toAdminProductListItemDto(
  product: ProductListItemWithRelations,
): Omit<AdminProductListItemDto, 'createdAt' | 'seoScore'> {
  const primaryMedia = product.media.find((m) => m.isPrimary) ?? product.media[0];
  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: product.translations[0]?.name ?? product.slug,
    hasVariants: product.hasVariants,
    trackInventory: product.trackInventory,
    allowBackorder: product.allowBackorder,
    stock: product.stock,
    reservedStock: product.reservedStock,
    stockStatus: product.stockStatus,
    price: decimalToString(product.price),
    salePrice: decimalToString(product.salePrice),
    status: product.status,
    categoryIds: product.categories.map((c) => c.categoryId),
    thumbnailUrl: primaryMedia?.media.url ?? null,
    variants: product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      price: decimalToString(v.price),
      salePrice: decimalToString(v.salePrice),
      stock: v.stock,
      reservedStock: v.reservedStock,
      stockStatus: v.stockStatus,
      isDefault: v.isDefault,
      // Drives the "Admin only" badge on the admin products table.
      isAdminOnly: v.isAdminOnly,
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
): PublicProductDto {
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
    flagLabel: product.flagLabel,
    videoUrl: product.videoUrl,
    hasVariants: product.hasVariants,
    stock: product.stock,
    stockStatus: product.stockStatus,
    trackInventory: product.trackInventory,
    allowBackorder: product.allowBackorder,
    price: decimalToString(product.price),
    salePrice: decimalToString(product.salePrice),
    saleStartsAt: product.saleStartsAt,
    saleEndsAt: product.saleEndsAt,
    shippableWeight: decimalToString(product.shippableWeight),
    minOrderQuantity: product.minOrderQuantity,
    maxOrderQuantity: product.maxOrderQuantity,
    name: translation?.name ?? product.slug,
    description: translation?.description ?? null,
    content: translation?.content ?? null,
    keyBenefits: translation?.keyBenefits ?? null,
    benefitPoints: translation?.benefitPoints ?? null,
    howToUse: translation?.howToUse ?? null,
    // Book "Specification" table (DIGITAL). Always mapped, not gated on
    // productType — a PHYSICAL product simply has them all null, and the
    // storefront branches on productType anyway.
    isbn: product.isbn,
    bookEdition: translation?.bookEdition ?? null,
    bookLanguage: translation?.bookLanguage ?? null,
    bookPublisher: translation?.bookPublisher ?? null,
    bookCountry: translation?.bookCountry ?? null,
    author:
      product.author && !product.author.deletedAt
        ? toPublicAuthorDto(product.author, locale)
        : null,
    brand: product.brand
      ? {
          id: product.brand.id,
          slug: product.brand.slug,
          name: brandTranslation?.name ?? product.brand.slug,
          description: brandTranslation?.description ?? null,
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
      cardUrl: m.media.cardUrl,
      fullUrl: m.media.fullUrl,
      type: m.media.type,
      isPrimary: m.isPrimary,
      // Drives the PDP gallery jumping to the selected variant's own image
      // (null = shared gallery image, shown for every variant).
      variantId: m.variantId,
    })),
    // Public surface #1 (see the 20260903000000_variant_admin_only migration
    // for the full list): admin-only variants are dropped entirely rather
    // than flagged, so nothing downstream — PDP, collections, structured
    // data, price ranges — can accidentally render or price one.
    variants: product.variants
      .filter((v) => !v.isAdminOnly)
      .map((v) => ({
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

// The DIGITAL half of the public PDP payload, kept out of toPublicProductDto
// because only the detail endpoint needs it — the list/card shape would
// otherwise carry a preview-image array per row for no reader.
//
// Every field is enumerated by hand rather than spread from the Prisma row:
// digitalFileKey sits on that same row and IS the paid PDF's object key on a
// public bucket, so any `...product` or broad `select` here would hand out a
// permanent unauthenticated download link. That leak has already been shipped
// and caught three times in this feature — keep the list explicit.
export function toPublicProductDigitalFields(product: ProductWithRelations): {
  digitalPageCount: number | null;
  digitalPreviewStartPage: number | null;
  digitalPreviewEndPage: number | null;
  digitalFileFormat: string | null;
  digitalFileSize: number | null;
  previewPages: PublicProductPreviewPageDto[];
} {
  return {
    digitalPageCount: product.digitalPageCount,
    digitalPreviewStartPage: product.digitalPreviewStartPage,
    digitalPreviewEndPage: product.digitalPreviewEndPage,
    // DERIVED, never stored and never the raw filename — see
    // digitalFileFormat() below for why the name itself stays private.
    digitalFileFormat: digitalFileFormat(product.digitalFileName),
    digitalFileSize: product.digitalFileSize,
    previewPages: product.previewPages.map((p) => ({
      pageNumber: p.pageNumber,
      imageUrl: p.imageUrl,
    })),
  };
}

// The Specification tab's "Type" row — "PDF", not a MIME type and not a
// lowercase extension.
//
// Derived from digitalFileName rather than stored, so the row can never
// disagree with the file the buyer actually downloads (the upload endpoint
// only accepts application/pdf today, but that is a validation rule, not a
// promise about tomorrow).
//
// digitalFileName itself is deliberately NOT returned to the public. It is a
// component of the R2 object key (`digital/{uuid}-{sanitizedFilename}.pdf`),
// and while the uuid is the unguessable half, there is no reader for the name
// on the storefront — only for its extension. Emitting less is free here.
function digitalFileFormat(fileName: string | null): string | null {
  if (!fileName) return null;
  const dot = fileName.lastIndexOf('.');
  if (dot < 0 || dot === fileName.length - 1) return null;
  return fileName.slice(dot + 1).toUpperCase();
}
