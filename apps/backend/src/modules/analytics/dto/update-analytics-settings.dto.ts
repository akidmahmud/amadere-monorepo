import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateGa4SettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'e.g. G-XXXXXXXXXX' })
  @IsOptional()
  @IsString()
  measurementId?: string;
}

export class UpdateGtmSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'e.g. GTM-XXXXXXX' })
  @IsOptional()
  @IsString()
  containerId?: string;
}

export class UpdateMetaSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Meta Pixel ID' })
  @IsOptional()
  @IsString()
  pixelId?: string;
}

export class UpdateGoogleAdsSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'e.g. AW-XXXXXXXXX' })
  @IsOptional()
  @IsString()
  conversionId?: string;

  @ApiPropertyOptional({ description: 'Conversion label for the purchase conversion action' })
  @IsOptional()
  @IsString()
  conversionLabel?: string;
}

export class UpdateTiktokSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'TikTok Pixel Code' })
  @IsOptional()
  @IsString()
  pixelCode?: string;
}

export class UpdateClaritySettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Microsoft Clarity Project ID' })
  @IsOptional()
  @IsString()
  projectId?: string;
}

export class UpdateUtmSettingsDto {
  @ApiPropertyOptional({ description: 'Capture utm_source/medium/campaign/term/content from landing URLs' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateCustomScriptSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Raw <head> tracking script, e.g. Matomo/Plausible/Fathom snippets' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  headerScript?: string;

  @ApiPropertyOptional({ description: 'Raw markup injected near the top of <body> (e.g. a noscript fallback)' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  bodyScript?: string;
}
