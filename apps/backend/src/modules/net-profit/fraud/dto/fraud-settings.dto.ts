import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

// CLAUDE.net-profit.ADDENDUM.md §A — replaces the base spec's minOrders/
// highThreshold/mediumThreshold/single-action scheme with the plugin's
// actual ladder: acceptPercent + allowNoHistory + a separate advance
// threshold, with block and advance as independent toggles (a store can
// want both at once) rather than one exclusive action.
export class FraudSettingsDto {
  @ApiProperty()
  enabled!: boolean;

  @ApiProperty({ description: 'successRate% at/above this passes (0-100)' })
  acceptPercent!: number;

  @ApiProperty({ description: 'When a phone has zero delivery history: true = pass, false = treat as risky' })
  allowNoHistory!: boolean;

  @ApiProperty({ description: 'Require advance payment when successRate% is below this' })
  advanceEnabled!: boolean;

  @ApiProperty({ description: 'successRate% below this (and above 0) triggers advance, not block (0-100, <= acceptPercent)' })
  advanceScoreThreshold!: number;

  @ApiProperty({ description: 'Percent of order total required upfront when advance triggers' })
  advanceRequiredPercent!: number;

  @ApiProperty({ description: 'Reject the checkout outright when successRate% is below acceptPercent (and not already caught by advance)' })
  blockEnabled!: boolean;

  @ApiProperty()
  cacheTtlHours!: number;

  @ApiProperty()
  blockMessageEn!: string;

  @ApiProperty()
  blockMessageBn!: string;
}

export class UpdateFraudSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  acceptPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowNoHistory?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  advanceEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  advanceScoreThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  advanceRequiredPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  blockEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  cacheTtlHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  blockMessageEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  blockMessageBn?: string;
}
