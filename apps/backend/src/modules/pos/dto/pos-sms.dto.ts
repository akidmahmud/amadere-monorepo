import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PosTierDto {
  @IsOptional() @IsString() @MaxLength(40) key?: string;
  @IsString() @MaxLength(40) name!: string;
  @Type(() => Number) @IsInt() @Min(0) minOrders!: number;
  @Type(() => Number) @IsNumber() @Min(0) minSpent!: number;
  @Matches(/^#[0-9a-fA-F]{6}$/) color!: string;
}

export class PosTiersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PosTierDto)
  tiers!: PosTierDto[];
}

export class PosSmsSettingsDto {
  @IsBoolean() thankYouEnabled!: boolean;
  @IsString() @MaxLength(612) thankYouMessage!: string;
  @IsString() @MaxLength(200) websiteUrl!: string;
}

export class PosSmsTestDto {
  @Matches(/^(\+?88)?01[3-9]\d{8}$/, { message: 'Enter a valid BD mobile number' })
  phone!: string;
}

export class PosSmsCampaignDto {
  @IsString() @MaxLength(80) name!: string;
  @IsOptional() @Type(() => Number) @IsInt() storeId?: number | null;
  @IsOptional() @IsString() @MaxLength(40) tierKey?: string | null;
  @IsIn(['NOW', 'SCHEDULED', 'RECURRING', 'TIER_UPGRADE', 'WINBACK'])
  type!: 'NOW' | 'SCHEDULED' | 'RECURRING' | 'TIER_UPGRADE' | 'WINBACK';
  @IsString() @MaxLength(612) message!: string;
  @IsOptional() @IsString() sendAt?: string | null;
  @IsOptional() @IsIn(['DAILY', 'WEEKLY', 'MONTHLY']) repeat?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) winbackDays?: number | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class PosSmsPreviewDto {
  @IsOptional() @Type(() => Number) @IsInt() storeId?: number | null;
  @IsOptional() @IsString() tierKey?: string | null;
  @IsIn(['NOW', 'SCHEDULED', 'RECURRING', 'TIER_UPGRADE', 'WINBACK'])
  type!: 'NOW' | 'SCHEDULED' | 'RECURRING' | 'TIER_UPGRADE' | 'WINBACK';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) winbackDays?: number | null;
}
