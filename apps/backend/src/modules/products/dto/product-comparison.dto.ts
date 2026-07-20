import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';

// Not translatable — same images regardless of locale. Lives on Product
// itself; paired text (heading/titles/list items) lives in
// ProductComparisonContentDto on each ProductTranslation instead.
export class ProductComparisonImagesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  card1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  card2?: string;
}

export class ProductComparisonCardContentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'One bullet line per line of text, same convention as keyBenefits.' })
  @IsOptional()
  @IsString()
  items?: string;
}

// One per ProductTranslation (EN/BN) — card1 is always "us" (checkmark
// styling), card2 is always "them" (X-mark styling), fixed by position.
export class ProductComparisonContentDto {
  @ApiPropertyOptional({ description: 'Admin-authored HTML, same trust level as description/content' })
  @IsOptional()
  @IsString()
  heading?: string;

  @ApiPropertyOptional({ type: ProductComparisonCardContentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductComparisonCardContentDto)
  card1?: ProductComparisonCardContentDto;

  @ApiPropertyOptional({ type: ProductComparisonCardContentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductComparisonCardContentDto)
  card2?: ProductComparisonCardContentDto;
}
