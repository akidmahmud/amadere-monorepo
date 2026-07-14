import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUrl } from 'class-validator';

export const MANUAL_PAYMENT_METHODS = ['bkash', 'nagad', 'rocket', 'upay'] as const;

// Ported verbatim from the reference plugin's validate_fields() — each
// mobile financial service has its own real transaction-ID shape. Checked
// in ManualPaymentService.submit() (needs `method` to pick the right
// pattern — cross-field, so a plain class-validator decorator can't do it
// declaratively without a bespoke @ValidateBy).
export const TRX_ID_PATTERNS: Record<(typeof MANUAL_PAYMENT_METHODS)[number], { regex: RegExp; hint: string }> = {
  bkash: { regex: /^[A-Z0-9]{10}$/, hint: 'a valid 10-character bKash Transaction ID' },
  nagad: { regex: /^[A-Z0-9]{8}$/, hint: 'a valid 8-character Nagad Transaction ID' },
  rocket: { regex: /^[0-9]{10,12}$/, hint: 'a valid 10 to 12 digit Rocket Transaction ID' },
  upay: { regex: /^[A-Z0-9]{8,10}$/, hint: 'a valid 8 to 10 character Upay Transaction ID' },
};

export class SubmitManualPaymentDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  orderId!: number;

  @ApiProperty({ enum: MANUAL_PAYMENT_METHODS })
  @IsIn(MANUAL_PAYMENT_METHODS)
  method!: (typeof MANUAL_PAYMENT_METHODS)[number];

  @ApiProperty()
  @IsString()
  senderMsisdn!: string;

  @ApiProperty()
  @IsString()
  trxId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  screenshotUrl?: string;
}
