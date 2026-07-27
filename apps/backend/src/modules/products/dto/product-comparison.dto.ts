import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';

// PDP "Why Choose Us" comparison table — one row per feature, checkmark/X per
// column. Entirely hidden on the storefront when rows is empty/absent.
export class ProductComparisonRowDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  feature?: string;

  @ApiPropertyOptional({ description: 'Checkmark under the own-product column' })
  @IsOptional()
  @IsBoolean()
  own?: boolean;

  @ApiPropertyOptional({ description: 'Checkmark under the competitor column' })
  @IsOptional()
  @IsBoolean()
  competitor?: boolean;
}

// One per ProductTranslation (EN/BN) — labels and feature text are
// translatable; the own/competitor booleans are duplicated per locale for
// simplicity (same convention as every other per-locale content field here).
export class ProductComparisonTableDto {
  @ApiPropertyOptional({ description: 'Defaults to "Why Choose {Product Name}?" when left blank' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Defaults to the product name when left blank' })
  @IsOptional()
  @IsString()
  ownLabel?: string;

  @ApiPropertyOptional({ description: 'e.g. "Regular White Rice"' })
  @IsOptional()
  @IsString()
  competitorLabel?: string;

  @ApiPropertyOptional({ type: [ProductComparisonRowDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductComparisonRowDto)
  rows?: ProductComparisonRowDto[];
}
