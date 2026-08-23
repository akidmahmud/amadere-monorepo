import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ContentStatus,
  CostPriceUnit,
  ProductFlagLabel,
  ProductType,
  StockStatus,
} from '@amader/db';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProductTranslationDto } from './product-translation.dto';
import { CreateProductVariantDto } from './create-product-variant.dto';

// Assigns one gallery image to one variant, so the PDP can swap the gallery
// when that variant is selected. Sent alongside `mediaIds` (which still owns
// gallery order and which image is primary) rather than replacing it, so
// every existing caller that only sends mediaIds keeps working unchanged.
export class MediaVariantAssignmentDto {
  @ApiProperty()
  @IsInt()
  mediaId!: number;

  @ApiProperty({
    nullable: true,
    description: 'Variant id, or null to clear the assignment.',
  })
  @IsOptional()
  @IsInt()
  variantId!: number | null;
}

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  brandId?: number;

  // Nullable so clearing the dropdown actually unlinks the author — an
  // omitted/undefined value means "leave unchanged" on update, the same
  // convention videoUrl and costPriceUnit already use below.
  @ApiPropertyOptional({ nullable: true, description: 'Book author (Author record id)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  authorId?: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Book Specification — ISBN (locale-invariant)' })
  @IsOptional()
  @IsString()
  isbn?: string | null;

  @ApiPropertyOptional({ enum: ProductType, default: ProductType.PHYSICAL })
  @IsOptional()
  @IsEnum(ProductType)
  productType?: ProductType;

  @ApiPropertyOptional({ enum: ContentStatus, default: ContentStatus.DRAFT })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ enum: ProductFlagLabel, nullable: true })
  @IsOptional()
  @IsEnum(ProductFlagLabel)
  flagLabel?: ProductFlagLabel | null;

  // Nullable so clearing the field in the admin form actually wipes it —
  // an omitted/undefined value means "leave unchanged" on update, same
  // convention as costPriceUnit.
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  videoUrl?: string | null;

  @ApiPropertyOptional({
    default: false,
    description:
      'If true, price/stock live on variants instead of the product itself',
  })
  @IsOptional()
  @IsBoolean()
  hasVariants?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowBackorder?: boolean;

  @ApiPropertyOptional({
    default: 0,
    description: 'Ignored when hasVariants is true',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ enum: StockStatus, default: StockStatus.IN_STOCK })
  @IsOptional()
  @IsEnum(StockStatus)
  stockStatus?: StockStatus;

  @ApiPropertyOptional({ description: 'Required when hasVariants is false' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salePrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  saleStartsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  saleEndsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPerItem?: number;

  @ApiPropertyOptional({
    enum: CostPriceUnit,
    nullable: true,
    description:
      'When set, costPerItem is a rate per this unit of weight, scaled per-variant by weightOverride, instead of a flat cost. Only meaningful when hasVariants is true.',
  })
  @IsOptional()
  @IsEnum(CostPriceUnit)
  costPriceUnit?: CostPriceUnit | null;

  @ApiPropertyOptional({ description: 'Kilograms' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  shippableWeight?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minOrderQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxOrderQuantity?: number;

  @ApiProperty({ type: [ProductTranslationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProductTranslationDto)
  translations!: ProductTranslationDto[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  categoryIds?: number[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  tagIds?: number[];

  @ApiPropertyOptional({
    type: [Number],
    description: 'Variation axes (Attribute ids) this product uses',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  attributeIds?: number[];

  @ApiPropertyOptional({
    type: [Number],
    description: 'Media ids, in gallery order (first = primary image)',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  mediaIds?: number[];

  @ApiPropertyOptional({
    type: [MediaVariantAssignmentDto],
    description:
      'Optional per-image variant assignment. Any mediaId omitted here stays a shared gallery image shown for every variant. Only meaningful for products whose variants already exist (i.e. on edit), since a brand-new product creates its variants in the same request and they have no ids yet.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaVariantAssignmentDto)
  mediaVariantAssignments?: MediaVariantAssignmentDto[];

  @ApiPropertyOptional({
    type: [CreateProductVariantDto],
    description: 'Required when hasVariants is true',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants?: CreateProductVariantDto[];
}
