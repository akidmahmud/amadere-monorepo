import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { NormalizeBdPhone } from '../../../common/validators/is-bd-phone.decorator';

/**
 * A beacon from the checkout page: "this shopper has told us who they are but
 * has not ordered yet."
 *
 * Everything is optional because it is fired while the form is still being
 * filled in — a phone with no email yet is exactly the case worth recording.
 * The row is only ever LISTED once at least one of these is present.
 */
export class CheckoutAbandonmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  // Normalized to the site-wide 880XXXXXXXXXX shape, like every other phone
  // field, so the row this creates can actually be matched later. Orders
  // store the normalized form (CheckoutAddressDto has @NormalizeBdPhone),
  // and this beacon used to store whatever was typed — so a shopper who
  // typed "01840193060", abandoned, then completed checkout left a row whose
  // phone never equalled the order's "8801840193060", and they stayed in the
  // abandonment list forever despite having bought.
  //
  // Deliberately NO @IsBdPhone() beside it: this beacon fires WHILE the
  // customer is typing, so a half-entered number is expected and must not
  // 400. NormalizeBdPhone falls through to the raw value when it cannot
  // parse, which is exactly the behaviour wanted here.
  @ApiPropertyOptional()
  @IsOptional()
  @NormalizeBdPhone()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  // Sent as whatever the shopper has typed SO FAR — every part optional,
  // because the whole point is capturing a half-filled form.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  area?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  division?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  landmark?: string;
}
