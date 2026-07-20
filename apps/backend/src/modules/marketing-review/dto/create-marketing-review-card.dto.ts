import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MarketingReviewCardTranslationDto } from './marketing-review-card-translation.dto';

export class CreateMarketingReviewCardDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  imageUrl!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ type: [MarketingReviewCardTranslationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MarketingReviewCardTranslationDto)
  translations!: MarketingReviewCardTranslationDto[];
}
