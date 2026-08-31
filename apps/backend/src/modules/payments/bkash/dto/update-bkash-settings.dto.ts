import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

const KEEP_EXISTING = 'Leave blank to keep the existing stored value';

export class UpdateBkashSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Live mode off = bKash sandbox' })
  @IsOptional()
  @IsBoolean()
  liveMode?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  methodNameEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  methodNameBn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descriptionBn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ description: KEEP_EXISTING })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: KEEP_EXISTING })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: KEEP_EXISTING })
  @IsOptional()
  @IsString()
  appKey?: string;

  @ApiPropertyOptional({ description: KEEP_EXISTING })
  @IsOptional()
  @IsString()
  appSecretKey?: string;
}
