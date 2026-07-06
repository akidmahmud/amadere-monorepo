import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HomepageSectionType, Locale } from '@amader/db';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class HomepageSectionTranslationDto {
  @ApiProperty({ enum: Locale })
  @IsEnum(Locale)
  locale!: Locale;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  heading?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subheading?: string;
}

export class CreateHomepageSectionDto {
  @ApiProperty({ enum: HomepageSectionType })
  @IsEnum(HomepageSectionType)
  type!: HomepageSectionType;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      'Type-specific layout data, e.g. HERO_BANNER: { slides: [{ imageUrl, linkUrl? }] }',
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Required when type = PRODUCT_COLLECTION',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  collectionId?: number;

  @ApiPropertyOptional({ type: [HomepageSectionTranslationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HomepageSectionTranslationDto)
  translations?: HomepageSectionTranslationDto[];
}
