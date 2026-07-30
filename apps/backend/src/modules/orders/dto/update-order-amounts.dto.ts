import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

// Discount/shipping-fee "pencil edit" fields — staff correction of amounts
// that were either auto-computed at creation or entered manually. Editing
// these does NOT re-run coupon/discount eligibility checks (same
// simplification as item edits — see OrdersService.recomputeTotals).
export class UpdateOrderAmountsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingAmount?: number;

  @ApiPropertyOptional({ description: 'Coupon code label shown next to the discount amount — cosmetic only, not re-validated' })
  @IsOptional()
  @IsString()
  couponCode?: string;
}
