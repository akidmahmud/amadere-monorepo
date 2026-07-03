import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Locale } from '@amader/db';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class AttributeTranslationDto {
  @ApiProperty({ enum: Locale })
  @IsEnum(Locale)
  locale!: Locale;

  @ApiProperty()
  @IsString()
  name!: string;
}

export class CreateAttributeDto {
  @ApiProperty()
  @IsString()
  slug!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiProperty({ type: [AttributeTranslationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttributeTranslationDto)
  translations!: AttributeTranslationDto[];
}
