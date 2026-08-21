import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { IsBdPhone, NormalizeBdPhone } from '../../../common/validators/is-bd-phone.decorator';

export class RegisterDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  // Optional so someone living outside Bangladesh can open an account at
  // all — the store still only DELIVERS inside BD, and checkout collects its
  // own BD recipient phone separately, so the account's own number was never
  // the delivery contact. Still validated as a BD mobile WHEN supplied: this
  // relaxes "must have one", not "must be Bangladeshi".
  //
  // register() rejects the case where neither phone nor email is given —
  // an account with no identifier at all can never be signed into.
  @ApiPropertyOptional()
  @IsOptional()
  @NormalizeBdPhone()
  @IsBdPhone()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;

  // Where to send the signup code. Optional and defaults to PHONE, which is
  // both the old behaviour and the only possible choice when no email was
  // given — the customer is only ever ASKED when they actually supplied an
  // email (see RegisterForm). 'EMAIL' without an email is rejected in
  // register() rather than silently falling back, so a mis-wired client
  // can't leave someone waiting for a code that was never addressed
  // anywhere.
  @ApiPropertyOptional({ enum: ['PHONE', 'EMAIL'], default: 'PHONE' })
  @IsOptional()
  @IsIn(['PHONE', 'EMAIL'])
  otpChannel?: 'PHONE' | 'EMAIL';
}
