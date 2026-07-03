import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentStatus } from '@amader/db';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { NameDescriptionTranslationDto } from '../../../common/dto/name-description-translation.dto';

export class CreateProductBundleItemDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  productId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  variantId?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class CreateProductBundleDto {
  @ApiProperty()
  @IsString()
  slug!: string;

  @ApiPropertyOptional({
    description:
      'Fixed total price for the bundle (overrides discountPct if both given)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bundlePrice?: number;

  @ApiPropertyOptional({ description: 'Percentage off the sum of item prices' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountPct?: number;

  @ApiPropertyOptional({ enum: ContentStatus, default: ContentStatus.DRAFT })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @ApiProperty({ type: [NameDescriptionTranslationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => NameDescriptionTranslationDto)
  translations!: NameDescriptionTranslationDto[];

  @ApiProperty({ type: [CreateProductBundleItemDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateProductBundleItemDto)
  items!: CreateProductBundleItemDto[];
}
