import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export enum ProductSort {
  BEST_SELLING = 'BEST_SELLING',
  PRICE_ASC = 'PRICE_ASC',
  PRICE_DESC = 'PRICE_DESC',
  NEWEST = 'NEWEST',
}

// Repeated query keys (?categoryIds=1&categoryIds=2) already arrive as an
// array via Express's query parser; a single occurrence arrives as a bare
// string. Normalize both shapes to an array before @Type/@IsInt coerce it.
const toArray = ({ value }: { value: unknown }) =>
  value === undefined ? undefined : Array.isArray(value) ? value : [value];

export class ProductFilterQueryDto {
  @ApiPropertyOptional({ type: [Number], description: 'Matches products in ANY of the given categories.' })
  @IsOptional()
  @Transform(toArray)
  @Type(() => Number)
  @IsInt({ each: true })
  categoryIds?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  brandId?: number;

  @ApiPropertyOptional({ type: [Number], description: 'Matches products tagged with ANY of the given tags.' })
  @IsOptional()
  @Transform(toArray)
  @Type(() => Number)
  @IsInt({ each: true })
  tagIds?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description:
      'Filters on the simple-product price column only — hasVariants products (null price on the parent row) are excluded from a price-range filter, same known limitation as elsewhere in this module.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    enum: ProductSort,
    default: ProductSort.NEWEST,
    description:
      'BEST_SELLING orders by viewCount (a popularity proxy — no denormalized sales-count column exists yet).',
  })
  @IsOptional()
  @IsEnum(ProductSort)
  sort?: ProductSort;
}
