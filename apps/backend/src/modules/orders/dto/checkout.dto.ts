import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentProvider } from '@amader/db';
import { Type } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CheckoutAddressDto } from './checkout-address.dto';
import { IsBdPhone, NormalizeBdPhone } from '../../../common/validators/is-bd-phone.decorator';

// Contact fields for a digital-only checkout with no logged-in customer —
// there's no shippingAddress to carry a name/email/phone for that case (see
// CheckoutDto.shippingAddress), so this is the one place those are
// collected. Consumed by CheckoutAccountService.ensureAccount() to create
// (or reuse) a passwordless account before the order exists — see
// checkout.service.ts's digital-only branch.
export class CheckoutCreateAccountDto {
  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @NormalizeBdPhone()
  @IsBdPhone()
  phone?: string;
}

export class CheckoutDto {
  @ApiPropertyOptional({
    type: CheckoutAddressDto,
    description: 'Required unless every cart line is a digital product',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutAddressDto)
  shippingAddress?: CheckoutAddressDto;

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

  @ApiPropertyOptional({ description: 'Stable client-side device fingerprint (ADDENDUM §E) — used by the blocker device-block path' })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ description: 'Unix seconds when the checkout page loaded — used by the blocker speed/bot-detection rule' })
  @IsOptional()
  @IsInt()
  checkoutStartedAt?: number;

  @ApiPropertyOptional({ description: 'Campaign attribution — read from the utm_* landing-page cookie (apps/web utm.ts)' })
  @IsOptional()
  @IsString()
  utmSource?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  utmMedium?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  utmCampaign?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  utmTerm?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  utmContent?: string;

  @ApiPropertyOptional({ description: 'Referral/landing attribution — first-touch capture from the utm_* landing-page cookie (apps/web utm.ts)' })
  @IsOptional()
  @IsString()
  landingDomain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  landingPage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referrerUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referrerDomain?: string;

  @ApiPropertyOptional({
    type: CheckoutCreateAccountDto,
    description:
      'Digital-only checkout with no logged-in customer (identity.customerId): ' +
      'name/email/phone to create — or reuse — a passwordless account for. ' +
      'Ignored otherwise (a physical order already carries a shippingAddress).',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutCreateAccountDto)
  createAccount?: CheckoutCreateAccountDto;
}
