import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateUpsellBarSettingsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ required: false, enum: ['TOTAL_UNITS', 'DISTINCT_PRODUCTS'] })
  @IsOptional()
  @IsIn(['TOTAL_UNITS', 'DISTINCT_PRODUCTS'])
  countMode?: 'TOTAL_UNITS' | 'DISTINCT_PRODUCTS';

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxDiscountCap?: number | null;
}
