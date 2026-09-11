import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Per-send edits to the recovery email.
 *
 * Every field optional: an omitted or blank one falls back to the saved
 * default in Recovery > Settings. Nothing here is persisted — personalising
 * one chase must not silently rewrite the template everyone else uses.
 */
export class RecoveryEmailOverrideDto {
  @ApiPropertyOptional({ description: 'Supports {{name}} and {{total}}' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  heading?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  ctaLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  whatsappLabel?: string;

  @ApiPropertyOptional({
    description:
      'Coupon code to offer in this email. Validated before sending, and appended to the CTA link so it applies itself when they arrive.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  couponCode?: string;
}
