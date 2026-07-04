import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Locale, SeoEntityType } from '@amader/db';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class UpsertSeoMetaDto {
  @ApiProperty({ enum: SeoEntityType })
  @IsEnum(SeoEntityType)
  entityType!: SeoEntityType;

  @ApiProperty()
  @IsInt()
  entityId!: number;

  @ApiProperty({ enum: Locale })
  @IsEnum(Locale)
  locale!: Locale;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  canonicalUrl?: string;

  @ApiPropertyOptional({ default: 'index,follow' })
  @IsOptional()
  @IsString()
  robots?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ogTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ogDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ogImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  structuredDataType?: string;
}
