import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderChannel, PaymentProvider, PaymentStatus } from '@amader/db';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty, IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsPositive,
  IsString, Min, ValidateNested,
} from 'class-validator';
import { CheckoutAddressDto } from './checkout-address.dto';

export class ManualOrderItemDto {
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

  @ApiPropertyOptional({ description: "Overrides the product's real price for this line if set" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}

export class CreateManualOrderDto {
  @ApiPropertyOptional({ description: 'Set when staff selected an existing customer; omit to auto-match/create by shippingAddress.phone' })
  @IsOptional()
  @IsInt()
  customerId?: number;

  @ApiProperty({
    enum: OrderChannel,
    description: 'How this order was taken — never WEBSITE for a staff-created order',
  })
  @IsEnum(OrderChannel)
  channel!: OrderChannel;

  @ApiProperty({ type: CheckoutAddressDto })
  @ValidateNested()
  @Type(() => CheckoutAddressDto)
  shippingAddress!: CheckoutAddressDto;

  @ApiPropertyOptional({ type: CheckoutAddressDto, description: 'Defaults to shippingAddress if omitted' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutAddressDto)
  billingAddress?: CheckoutAddressDto;

  @ApiProperty({ type: [ManualOrderItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ManualOrderItemDto)
  items!: ManualOrderItemDto[];

  @ApiProperty({ enum: PaymentProvider })
  @IsEnum(PaymentProvider)
  paymentProvider!: PaymentProvider;

  @ApiPropertyOptional({
    description: 'Staff-entered tax, added on top of the line-item subtotal',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @ApiPropertyOptional({
    description: 'Staff-entered discount, on top of any per-line price override',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({
    description: 'Staff-entered promotion allowance — a second, separate manual reduction alongside discountAmount',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  promotionAmount?: number;

  @ApiPropertyOptional({ description: 'Staff-entered shipping fee — defaults to free (0) if omitted' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingAmount?: number;

  @ApiPropertyOptional({
    description: 'A real Discount/coupon code — validated and priced the exact same way real checkout does (expiry, usage limits, min order amount, product/category scope), and recorded as a redemption on success.',
  })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({
    description: 'bKash/Nagad/Rocket/Upay transaction ID, when the staff already has it (e.g. read out over the phone) — recorded straight onto the order\'s payment record instead of going through the customer-submitted manual-payment verification queue.',
  })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({
    enum: PaymentStatus,
    description: 'Overrides the payment provider\'s default authorization status — e.g. mark a manual (bKash/Nagad) payment CAPTURED immediately when staff has already confirmed receipt.',
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerNote?: string;
}
