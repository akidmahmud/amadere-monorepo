import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentProvider } from '@amader/db';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CheckoutAddressDto } from './checkout-address.dto';

export class CheckoutDto {
  @ApiProperty({ type: CheckoutAddressDto })
  @ValidateNested()
  @Type(() => CheckoutAddressDto)
  shippingAddress!: CheckoutAddressDto;

  @ApiPropertyOptional({
    type: CheckoutAddressDto,
    description: 'Defaults to shippingAddress if omitted',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutAddressDto)
  billingAddress?: CheckoutAddressDto;

  @ApiProperty({ enum: PaymentProvider })
  @IsEnum(PaymentProvider)
  paymentProvider!: PaymentProvider;

  @ApiPropertyOptional({
    description:
      'Required when paymentProvider is COD (see POST /checkout/cod-otp/request)',
  })
  @IsOptional()
  @IsString()
  codOtpCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  giftVoucherCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerNote?: string;
}
