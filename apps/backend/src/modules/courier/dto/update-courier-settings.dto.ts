import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateSteadfastSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Leave blank to keep the existing stored key' })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({ description: 'Leave blank to keep the existing stored key' })
  @IsOptional()
  @IsString()
  secretKey?: string;
}

export class UpdatePathaoSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ enum: ['live', 'sandbox'] })
  @IsOptional()
  @IsIn(['live', 'sandbox'])
  environment?: 'live' | 'sandbox';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoStatusSync?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Leave blank to keep the existing stored secret' })
  @IsOptional()
  @IsString()
  clientSecret?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Leave blank to keep the existing stored password' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  storeId?: number;
}

export class UpdateRedxSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ enum: ['live', 'sandbox'] })
  @IsOptional()
  @IsIn(['live', 'sandbox'])
  environment?: 'live' | 'sandbox';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoStatusSync?: boolean;

  @ApiPropertyOptional({ description: 'Leave blank to keep the existing stored token' })
  @IsOptional()
  @IsString()
  apiToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pickupStoreId?: number;
}
