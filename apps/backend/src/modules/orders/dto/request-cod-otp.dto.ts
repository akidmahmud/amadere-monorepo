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
}
