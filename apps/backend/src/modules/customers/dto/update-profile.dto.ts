import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  // Editable because a large share of migrated customers carry a synthetic
  // `<phone>@temporary.com` address from the old system and had no way to
  // replace it — and now that password login accepts an email, the address
  // on the account decides whether they can use that at all.
  //
  // Omitted (undefined) means "leave unchanged", same PATCH semantics as
  // every other field here. There's deliberately no way to CLEAR it back to
  // null: @IsEmail rejects an empty string, and an account silently losing
  // its only non-phone identifier is not something a stray empty form field
  // should be able to do.
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  dob?: string;
}
