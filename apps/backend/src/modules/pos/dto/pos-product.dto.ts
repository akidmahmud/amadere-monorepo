import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class PosProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salePrice?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPerItem?: number | null;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number | null;

  /** Weight in kg (printed on the receipt); null clears it. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weightKg?: number | null;
  /** Display unit for the weight: g | kg | ml | l (ml/l stored as litres). */
  @IsOptional()
  @IsIn(['g', 'kg', 'ml', 'l'])
  weightUnit?: 'g' | 'kg' | 'ml' | 'l' | null;

  /** Uploaded media id; null removes the photo, omitted leaves it. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  mediaId?: number | null;
}

export class StorePriceDto {
  @Type(() => Number)
  @IsInt()
  productId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  variantId?: number | null;

  /** null = use the product's normal price again. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  price?: number | null;

  /** This store's own weight in kg (receipt); null = the normal weight. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  weightKg?: number | null;
  /** Display unit for the weight: g | kg | ml | l (ml/l stored as litres). */
  @IsOptional()
  @IsIn(['g', 'kg', 'ml', 'l'])
  weightUnit?: 'g' | 'kg' | 'ml' | 'l' | null;

  /** This store's own name for it; null/blank = the normal name. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  salePrice?: number | null;
}

export class DuplicateStoreDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @Matches(/^[A-Z0-9]{2,10}$/, { message: 'Code: 2-10 capital letters/digits' })
  code!: string;
}

export class PosImageDto {
  /** null = remove the photo. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  mediaId?: number | null;
}
