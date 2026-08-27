import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;
}
