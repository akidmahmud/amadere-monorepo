import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Locale } from '@amader/db';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { ProductFaqDto } from './product-faq.dto';

function stripHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function IsPlainLengthMax(max: number, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPlainLengthMax',
      target: object.constructor,
      propertyName: propertyName,
      options: {
        message: `${propertyName} text (excluding HTML tags) must not exceed ${max} characters`,
        ...validationOptions,
      },
      validator: {
        validate(value: any) {
          if (value === undefined || value === null || value === '') return true;
          if (typeof value !== 'string') return false;
          return stripHtml(value).length <= max;
        },
      },
    });
  };
}

export class ProductTranslationDto {
  @ApiProperty({ enum: Locale })
  @IsEnum(Locale)
  locale!: Locale;

  @ApiProperty()
  @IsString()
  name!: string;

  // Admin's Short Description field shows a "X/350" character counter —
  // HTML tags/markup are excluded from character count so legacy HTML wrappers
  // don't trigger validation failures.
  @ApiPropertyOptional({ description: 'Short Description — teaser near the title and the PDP\'s "About This Product" section', maxLength: 350 })
  @IsOptional()
  @IsString()
  @IsPlainLengthMax(350)
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
