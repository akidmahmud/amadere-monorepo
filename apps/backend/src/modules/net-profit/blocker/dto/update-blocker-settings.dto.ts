import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

// The settings payload is a partial, deep-merged BlockerSettings — the
// nested `rules`/`thresholds`/`popup`/`manual` blobs are stored and
// validated as opaque JSON (their shape lives in blocker-settings.types.ts)
// rather than exploded into class-validator DTOs, matching how
// NetProfitSettingsService.setNamespace already treats every other Net
// Profit settings namespace (fraud, sms, otp-security, ...).
export class UpdateBlockerSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showReasonInPopup?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  defaultDurationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  manual?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  rules?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  thresholds?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  popup?: Record<string, unknown>;
}

export class ImportCsvDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;
}
