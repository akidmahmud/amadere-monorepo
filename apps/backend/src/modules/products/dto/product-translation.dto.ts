import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Locale } from '@amader/db';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ProductInfoVisualContentDto } from './product-info-visual.dto';
import { ProductComparisonContentDto } from './product-comparison.dto';

export class ProductTranslationDto {
  @ApiProperty({ enum: Locale })
  @IsEnum(Locale)
  locale!: Locale;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nutrition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ingredients?: string;

  @ApiPropertyOptional({ description: 'Short benefit lines, one per line — rendered as the PDP\'s "Key Benefits" grid.' })
  @IsOptional()
  @IsString()
  keyBenefits?: string;

  @ApiPropertyOptional({ type: ProductInfoVisualContentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductInfoVisualContentDto)
  infoVisualContent?: ProductInfoVisualContentDto;

  @ApiPropertyOptional({ type: ProductComparisonContentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductComparisonContentDto)
  comparisonContent?: ProductComparisonContentDto;
}
