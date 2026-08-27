import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import { IsBdPhone, NormalizeBdPhone } from '../../../common/validators/is-bd-phone.decorator';

export class RequestCodOtpDto {
  @ApiProperty({
    description: 'Shipping phone number the order will be placed under',
  })
  @IsString()
  @NormalizeBdPhone()
  @IsBdPhone()
  phone!: string;

  // Where to DELIVER the code. The Otp row is still keyed on `phone`
  // regardless (see requestCodOtp) — checkout() verifies against
  // shippingAddress.phone, so changing the stored identifier would break
  // verification. This picks the transport, not the identity.
  @ApiPropertyOptional({ enum: ['PHONE', 'EMAIL'], default: 'PHONE' })
  @IsOptional()
  @IsIn(['PHONE', 'EMAIL'])
  channel?: 'PHONE' | 'EMAIL';

  // Required when channel is EMAIL — the order's email, which the customer
  // may have typed at checkout without it being on their account.
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  // Recorded against the abandoned-cart row, not used for the OTP itself:
  // when someone gets a code and never enters it, the recovery list needs a
  // name to call, and a guest has none anywhere else.
  @ApiPropertyOptional({ description: "Recipient name, for abandonment recovery only" })
  @IsOptional()
  @IsString()
  name?: string;
}
