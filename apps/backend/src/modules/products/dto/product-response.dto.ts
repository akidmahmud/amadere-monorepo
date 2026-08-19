import {
  ContentStatus,
  CostPriceUnit,
  Locale,
  MediaType,
  ProductFlagLabel,
  ProductType,
  StockStatus,
} from '@amader/db';
import { ResolvedSeoDto } from '../../seo/seo.mapper';

export class AdminProductFaqDto {
  question!: string;
  answer!: string;
  sortOrder!: number;
}

export class AdminProductTranslationDto {
  locale!: Locale;
  name!: string;
  description!: string | null;
  content!: string | null;
  keyBenefits!: string | null;
  benefitPoints!: string | null;
  howToUse!: string | null;
  faqs!: AdminProductFaqDto[];
}

export class AdminProductMediaDto {
  id!: number;
  url!: string;
  /** ~400w WebP thumbnail, null until the derivative pipeline has run — see Media.cardUrl. */
  cardUrl!: string | null;
  /** ~1200w-capped WebP for full-size display, same null/fallback rule as cardUrl. */
  fullUrl!: string | null;
  altText!: string | null;
  isPrimary!: boolean;
  sortOrder!: number;
  /** Optional variant this image belongs to. Null = shared gallery image
   * shown for every variant (the default). */
  variantId!: number | null;
}

export class AdminProductVariantDto {
  id!: number;
  sku!: string | null;
  barcode!: string | null;
  price!: string | null;
  salePrice!: string | null;
  stock!: number;
  // reservedStock is held by in-progress orders — reserveStock() (order
  // creation/item-add) enforces stock - reservedStock >= quantity, but
  // stockStatus is derived from stock alone (products.service.ts) and goes
  // stale once reservations eat all the remaining stock. Admin UIs that need
  // to know whether adding this variant to an order will actually succeed
  // must compute availability from stock - reservedStock, not stockStatus.
  reservedStock!: number;
  stockStatus!: StockStatus;
  weightOverride!: string | null;
  isDefault!: boolean;
  attributeValueIds!: number[];
}

export class AdminProductDto {
  id!: number;
  slug!: string;
  sku!: string | null;
  brandId!: number | null;
  productType!: ProductType;
  status!: ContentStatus;
  isFeatured!: boolean;
  flagLabel!: ProductFlagLabel | null;
  videoUrl!: string | null;
  hasVariants!: boolean;
  trackInventory!: boolean;
  allowBackorder!: boolean;
  stock!: number;
  // Same staleness caveat as AdminProductVariantDto.reservedStock — only
  // relevant when hasVariants is false (a variant purchase always checks its
  // own stock/reservedStock, ignoring the parent product's).
  reservedStock!: number;
  stockStatus!: StockStatus;
  price!: string | null;
  salePrice!: string | null;
  saleStartsAt!: Date | null;
  saleEndsAt!: Date | null;
  costPerItem!: string | null;
  costPriceUnit!: CostPriceUnit | null;
  shippableWeight!: string | null;
  minOrderQuantity!: number;
  maxOrderQuantity!: number | null;
  translations!: AdminProductTranslationDto[];
  categoryIds!: number[];
  tagIds!: number[];
  attributeIds!: number[];
  media!: AdminProductMediaDto[];
  variants!: AdminProductVariantDto[];
  /** Populated by the list endpoint only — not needed by create/update/detail responses. */
  createdAt?: Date;
  /** Rule-based 0-100 score (see seo-score.util.ts) — not AI-generated. List endpoint only. */
  seoScore?: number;
}

// Deliberately minimal — id/slug/name only, no media/variants/tags/attributes
// — for pickers that just need a checkbox list of product names (e.g.
// collection/cross-sell editors). The full AdminProductDto's PRODUCT_INCLUDE
// pulls in every variant's attribute values, every category/tag/attribute's
// translations, etc., which made a 100-row picker list genuinely slow to
// load once the catalog grew past a handful of products.
export class AdminProductPickerItemDto {
  id!: number;
  slug!: string;
  name!: string;
}

// Same rationale as AdminProductPickerItemDto above, applied to the actual
// Products table this time — only what ProductsTable.tsx renders (see
// PRODUCT_LIST_INCLUDE's comment for exactly what's dropped vs AdminProductDto).
export class AdminProductListVariantDto {
  id!: number;
  sku!: string | null;
  price!: string | null;
  salePrice!: string | null;
  stock!: number;
  reservedStock!: number;
  stockStatus!: StockStatus;
  isDefault!: boolean;
}

export class AdminProductListItemDto {
  id!: number;
  slug!: string;
  sku!: string | null;
  name!: string;
  hasVariants!: boolean;
  // Simple (no-variant) products only enforce stock when trackInventory is
  // on, and allowBackorder bypasses it entirely — same conditions
  // reserveStock() (stock-reservation.util.ts) checks. Needed by the order-
  // creation search UIs (useProductSearch), which reuse this same list
  // shape and gate "out of stock" on these two flags.
  trackInventory!: boolean;
  allowBackorder!: boolean;
  stock!: number;
  reservedStock!: number;
  stockStatus!: StockStatus;
  price!: string | null;
  salePrice!: string | null;
  status!: ContentStatus;
  categoryIds!: number[];
  thumbnailUrl!: string | null;
  variants!: AdminProductListVariantDto[];
  createdAt!: Date;
  /** Rule-based 0-100 score (see seo-score.util.ts) — not AI-generated. */
  seoScore!: number;
}

// Trash listing — deliberately minimal, same rationale as the picker item
// above (a 100-row trash list doesn't need every variant/category/tag).
export class AdminDeletedProductDto {
  id!: number;
  slug!: string;
  name!: string;
  imageUrl!: string | null;
  deletedAt!: Date;
  /** Days until the nightly purge job permanently deletes this row (see
   * ProductsService.purgeExpiredTrash) — floored at 0, never negative. */
  daysRemaining!: number;
}

export class PublicProductBrandDto {
  id!: number;
  slug!: string;
  name!: string;
  description!: string | null;
}

export class PublicProductCategorySummaryDto {
  id!: number;
  slug!: string;
  name!: string;
}

export class PublicProductTagSummaryDto {
  id!: number;
  slug!: string;
  name!: string;
}

export class PublicProductMediaDto {
  url!: string;
  /** ~400w WebP thumbnail, null until the derivative pipeline has run — see Media.cardUrl. */
  cardUrl!: string | null;
  /** ~1200w-capped WebP for full-size display, same null/fallback rule as cardUrl. */
  fullUrl!: string | null;
  type!: MediaType;
  isPrimary!: boolean;
  /** Optional variant this image belongs to — the PDP gallery jumps to it
   * when that variant is selected. Null = shared image for every variant. */
  variantId!: number | null;
}

export class PublicProductVariantAttributeValueDto {
  attributeId!: number;
  attributeValueId!: number;
  value!: string;
  colorHex!: string | null;
}

export class PublicProductVariantDto {
  id!: number;
  sku!: string | null;
  price!: string | null;
  salePrice!: string | null;
  stock!: number;
  stockStatus!: StockStatus;
  isDefault!: boolean;
  attributeValues!: PublicProductVariantAttributeValueDto[];
}

export class PublicProductDto {
  id!: number;
  slug!: string;
  sku!: string | null;
  productType!: ProductType;
  isFeatured!: boolean;
  flagLabel!: ProductFlagLabel | null;
  videoUrl!: string | null;
  hasVariants!: boolean;
  stock!: number;
  stockStatus!: StockStatus;
  /** Whether `stock`/variant stock actually gate purchasing — false means
   * unlimited/untracked, so the storefront must not show "Out of Stock"
   * based on stock hitting 0 for these products. */
  trackInventory!: boolean;
  allowBackorder!: boolean;
  price!: string | null;
  salePrice!: string | null;
  saleStartsAt!: Date | null;
  saleEndsAt!: Date | null;
  shippableWeight!: string | null;
  minOrderQuantity!: number;
  maxOrderQuantity!: number | null;
  name!: string;
  description!: string | null;
  content!: string | null;
  keyBenefits!: string | null;
  benefitPoints!: string | null;
  howToUse!: string | null;
  brand!: PublicProductBrandDto | null;
  categories!: PublicProductCategorySummaryDto[];
  tags!: PublicProductTagSummaryDto[];
  media!: PublicProductMediaDto[];
  variants!: PublicProductVariantDto[];
  /** Total units sold based on real non-canceled orders in DB. */
  salesCount?: number;
}

export class ProductFaqPublicDto {
  question!: string;
  answer!: string;
}

export class PublicProductDetailDto extends PublicProductDto {
  seo!: ResolvedSeoDto;
  structuredData!: Record<string, unknown>[];
  faqs!: ProductFaqPublicDto[];
  // Admin-configured via ProductRelation (see AdminProductsController's
  // cross-sell/frequently-bought-together endpoints) — published products
  // only, empty array when nothing's configured or every pick got unpublished.
  crossSell!: PublicProductDto[];
  frequentlyBoughtTogether!: PublicProductDto[];
}
