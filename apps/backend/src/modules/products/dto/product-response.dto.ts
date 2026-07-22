import {
  ContentStatus,
  Locale,
  MediaType,
  ProductType,
  StockStatus,
} from '@amader/db';
import { ResolvedSeoDto } from '../../seo/seo.mapper';
import { ProductInfoVisualContentDto, ProductInfoVisualImagesDto } from './product-info-visual.dto';
import { ProductComparisonContentDto, ProductComparisonImagesDto } from './product-comparison.dto';

export class AdminProductTranslationDto {
  locale!: Locale;
  name!: string;
  description!: string | null;
  content!: string | null;
  nutrition!: string | null;
  ingredients!: string | null;
  keyBenefits!: string | null;
  infoVisualContent!: ProductInfoVisualContentDto | null;
  comparisonContent!: ProductComparisonContentDto | null;
}

export class AdminProductMediaDto {
  id!: number;
  url!: string;
  isPrimary!: boolean;
  sortOrder!: number;
}

export class AdminProductVariantDto {
  id!: number;
  sku!: string | null;
  barcode!: string | null;
  price!: string | null;
  salePrice!: string | null;
  stock!: number;
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
  videoUrl!: string | null;
  hasVariants!: boolean;
  trackInventory!: boolean;
  allowBackorder!: boolean;
  stock!: number;
  stockStatus!: StockStatus;
  price!: string | null;
  salePrice!: string | null;
  saleStartsAt!: Date | null;
  saleEndsAt!: Date | null;
  costPerItem!: string | null;
  shippableWeight!: string | null;
  minOrderQuantity!: number;
  maxOrderQuantity!: number | null;
  infoVisualImages!: ProductInfoVisualImagesDto | null;
  comparisonImages!: ProductComparisonImagesDto | null;
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

export class PublicProductBrandDto {
  id!: number;
  slug!: string;
  name!: string;
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
  type!: MediaType;
  isPrimary!: boolean;
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
  videoUrl!: string | null;
  hasVariants!: boolean;
  stock!: number;
  stockStatus!: StockStatus;
  price!: string | null;
  salePrice!: string | null;
  shippableWeight!: string | null;
  minOrderQuantity!: number;
  maxOrderQuantity!: number | null;
  name!: string;
  description!: string | null;
  content!: string | null;
  nutrition!: string | null;
  ingredients!: string | null;
  keyBenefits!: string | null;
  infoVisualImages!: ProductInfoVisualImagesDto | null;
  infoVisualContent!: ProductInfoVisualContentDto | null;
  comparisonImages!: ProductComparisonImagesDto | null;
  comparisonContent!: ProductComparisonContentDto | null;
  brand!: PublicProductBrandDto | null;
  categories!: PublicProductCategorySummaryDto[];
  tags!: PublicProductTagSummaryDto[];
  media!: PublicProductMediaDto[];
  variants!: PublicProductVariantDto[];
}

export class PublicProductDetailDto extends PublicProductDto {
  seo!: ResolvedSeoDto;
  structuredData!: Record<string, unknown>[];
}
