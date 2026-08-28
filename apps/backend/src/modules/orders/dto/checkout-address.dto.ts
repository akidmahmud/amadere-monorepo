import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * @IsOptional() only skips validation for undefined/null — an empty string
 * still runs @IsEmail() and fails. Every form that renders an optional field
 * as a controlled input sends '' when the user leaves it blank, so "email is
 * optional" was true in the decorator and false in practice: the admin's
 * recover-an-abandoned-cart form could not submit without an email.
 * Blank means "not given" here, on every optional field.
 */
const BlankToUndefined = () =>
  Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value));
import { IsBdPhone, NormalizeBdPhone } from '../../../common/validators/is-bd-phone.decorator';

export class CheckoutAddressDto {
  @ApiProperty()
  @IsString()
  recipientName!: string;

  @ApiProperty()
  @IsString()
  @NormalizeBdPhone()
  @IsBdPhone()
  phone!: string;

  // Steadfast's alternative_phone — a second contact number, optional
  // everywhere `phone` (the primary) is required.
  @BlankToUndefined()
  @ApiPropertyOptional()
  @IsOptional()
  @NormalizeBdPhone()
  @IsBdPhone()
  alternativePhone?: string;

  @BlankToUndefined()
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  // Optional — every BD district belongs to exactly one division, so it's
  // auto-derived from `district` (see toOrderAddressCreate) rather than
  // asked for separately. Kept accepting a client-sent value for backward
  // compatibility, but nothing sends one anymore.
  @BlankToUndefined()
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  division?: string;

  @ApiProperty()
  @IsString()
  district!: string;

  // Required — deliberately mandatory on the storefront checkout (see
  // apps/web's checkout-schema.ts: "Thana/Area is required"), even though
  // it's nullable at the DB level (a saved CustomerAddress can predate that
  // requirement). The admin's New Order form previously mislabeled this
  // "(optional)" — a real UI bug, not a sign this should be optional here —
  // fixed there instead, to match what checkout has always required.
  @ApiProperty({ description: 'Thana/upazila' })
  @IsString()
  area!: string;

  @BlankToUndefined()
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  landmark?: string;

  @ApiProperty()
  @IsString()
  addressLine!: string;

  @BlankToUndefined()
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postCode?: string;
}
