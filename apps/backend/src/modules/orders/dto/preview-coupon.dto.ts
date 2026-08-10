import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, IsOptional, IsPositive, IsString, ValidateNested } from 'class-validator';

export class PreviewCouponItemDto {
  @ApiProperty()
  @IsInt()
  productId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  variantId?: number;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  quantity!: number;
}

// Lets the New Order form show the real discount before the order is
// created — same PricingService.price() coupon logic (expiry, usage
// limits, min order amount, product/category scope) the actual create
// call runs, so the preview and the real charge never disagree.
export class PreviewCouponDto {
  @ApiProperty({ type: [PreviewCouponItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PreviewCouponItemDto)
  items!: PreviewCouponItemDto[];

  @ApiProperty()
  @IsString()
  couponCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  customerId?: number;
}

export class PreviewCouponResultDto {
  @ApiProperty()
  amount!: string;

  @ApiPropertyOptional()
  error?: string;
}
