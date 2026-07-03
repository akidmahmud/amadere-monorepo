import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Locale } from '@amader/db';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ProductTranslationDto {
  @ApiProperty({ enum: Locale })
  @IsEnum(Locale)
  locale!: Locale;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nutrition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ingredients?: string;
}
