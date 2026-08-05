import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Locale } from '@amader/db';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { ProductFaqDto } from './product-faq.dto';

export class ProductTranslationDto {
  @ApiProperty({ enum: Locale })
  @IsEnum(Locale)
  locale!: Locale;

  @ApiProperty()
  @IsString()
  name!: string;

  // Admin's Short Description field shows a "X/350" counter next to it —
  // the frontend also caps the textarea's `maxLength` at 350, but this is
  // the real enforcement (a direct API call could otherwise still bypass it).
  @ApiPropertyOptional({ description: 'Short Description — teaser near the title and the PDP\'s "About This Product" section', maxLength: 350 })
  @IsOptional()
  @IsString()
  @MaxLength(350)
  description?: string;

  @ApiPropertyOptional({ description: 'Full Description — rendered as the PDP\'s "Description" tab' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Benefit Badges — short lines, one per line, up to 4, rendered as the PDP\'s badge strip' })
  @IsOptional()
  @IsString()
  keyBenefits?: string;

  @ApiPropertyOptional({ description: 'PDP "Key Benefits" tab — one bullet line per line of text' })
  @IsOptional()
  @IsString()
  benefitPoints?: string;

  @ApiPropertyOptional({ description: 'PDP "How to Use" tab' })
  @IsOptional()
  @IsString()
  howToUse?: string;

  @ApiPropertyOptional({ type: [ProductFaqDto], description: 'PDP "FAQ" tab — list of question/answer pairs' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductFaqDto)
  faqs?: ProductFaqDto[];
}
