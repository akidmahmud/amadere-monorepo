import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentProvider } from '@amader/db';
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerNote?: string;
}
