import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  // Phone OR email, resolved by CustomerAuthService.findByIdentifier — the
  // same helper the OTP flows have always used. Deliberately NOT
  // @IsBdPhone()/@NormalizeBdPhone() (which this field previously carried as
  // `phone`): an email can't pass BD-mobile validation, and normalization
  // can't run on a value whose shape isn't known until it's inspected.
  // phoneLookupCandidates() normalizes internally when the value turns out
  // to be a phone, so nothing is lost.
  @ApiPropertyOptional({ description: 'Phone number or email' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  identifier?: string;

  // Legacy alias, kept only so a deployed storefront still posting `phone`
  // keeps working during the window where the backend has shipped and the
  // web app hasn't. Password login is the one path where a deploy-order gap
  // locks real customers out of their accounts, which is not worth saving
  // four lines over. Safe to delete once the storefront has been on
  // `identifier` for a release.
  @ApiPropertyOptional({ deprecated: true, description: 'Deprecated — use `identifier`' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phone?: string;

  @ApiProperty()
  @IsString()
  password!: string;
}
