import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Locale } from '@amader/db';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class MarketingReviewCardTranslationDto {
  @ApiProperty({ enum: Locale })
  @IsEnum(Locale)
  locale!: Locale;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caption?: string;
}
