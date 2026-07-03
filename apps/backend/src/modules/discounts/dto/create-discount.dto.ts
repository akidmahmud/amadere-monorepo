import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentStatus, DiscountType, DiscountValueType } from '@amader/db';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateDiscountDto {
  @ApiPropertyOptional({
    description: 'Required for COUPON, must be absent for PROMOTION',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType)
  type!: DiscountType;

  @ApiProperty({ enum: DiscountValueType })
  @IsEnum(DiscountValueType)
  valueType!: DiscountValueType;

  @ApiProperty({
    description:
      'Percentage (0-100) or fixed BDT amount; ignored for FREE_SHIPPING',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxUsesTotal?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxUsesPerCustomer?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ enum: ContentStatus, default: ContentStatus.DRAFT })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Restrict to these products (empty = all)',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  productIds?: number[];

  @ApiPropertyOptional({
    type: [Number],
    description: 'Restrict to these categories (empty = all)',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  categoryIds?: number[];

  @ApiPropertyOptional({
    type: [Number],
    description: 'Restrict to these customers (empty = all)',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  customerIds?: number[];
}
