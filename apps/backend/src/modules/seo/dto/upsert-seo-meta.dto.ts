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

  // Nullable on purpose: Prisma reads `undefined` in an update as "leave
  // unchanged", so omitting this could never clear a stored share image —
  // emptying the picker in the admin would silently keep the old one.
  // `@IsOptional()` skips validation for null as well as undefined, so an
  // explicit null passes through and clears the column.
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  ogImageUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  structuredDataType?: string;
}
