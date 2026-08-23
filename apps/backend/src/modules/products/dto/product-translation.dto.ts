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

function countWords(str: string): number {
  const plainText = stripHtml(str);
  if (!plainText) return 0;
  return plainText.split(/\s+/).filter(Boolean).length;
}

// Word-based, not character-based — matches the admin form's own counter
// (ProductFormFields.tsx's SHORT_DESCRIPTION_MAX_WORDS), which switched from
// a 350-character cap to a 450-word cap so products migrated from the old
// WooCommerce/Botble catalog (which can carry verbose legacy HTML) aren't
// rejected just for the markup's character weight. This validator has to
// match that switch exactly — a char-based backend cap left in place next to
// a word-based frontend cap meant a save could pass the form's own counter
// and still 400 here.
export function IsPlainWordCountMax(max: number, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPlainWordCountMax',
      target: object.constructor,
      propertyName: propertyName,
      options: {
        message: `${propertyName} text (excluding HTML tags) must not exceed ${max} words`,
        ...validationOptions,
      },
      validator: {
        validate(value: any) {
          if (value === undefined || value === null || value === '') return true;
          if (typeof value !== 'string') return false;
          return countWords(value) <= max;
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

  // Admin's Short Description field shows a "X/450" word counter — HTML
  // tags/markup are excluded from the count so legacy HTML wrappers don't
  // trigger validation failures.
  @ApiPropertyOptional({ description: 'Short Description — teaser near the title and the PDP\'s "About This Product" section' })
  @IsOptional()
  @IsString()
  @IsPlainWordCountMax(450)
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

  // Book "Specification" tab (DIGITAL products only) — the locale-VARYING
  // half. Display strings, not codes: "1st Edition" vs "১ম সংস্করণ". The
  // ISBN lives on CreateProductDto instead, since it reads the same in
  // every locale, and "No of Page"/"Weight" reuse digitalPageCount and
  // shippableWeight rather than getting duplicate fields here.
  @ApiPropertyOptional({ description: 'Book Specification — edition, e.g. "1st Edition"' })
  @IsOptional()
  @IsString()
  bookEdition?: string;

  @ApiPropertyOptional({ description: 'Book Specification — language, e.g. "Bangla"' })
  @IsOptional()
  @IsString()
  bookLanguage?: string;

  @ApiPropertyOptional({ description: 'Book Specification — publisher name' })
  @IsOptional()
  @IsString()
  bookPublisher?: string;

  @ApiPropertyOptional({ description: 'Book Specification — country of publication' })
  @IsOptional()
  @IsString()
  bookCountry?: string;

  @ApiPropertyOptional({ type: [ProductFaqDto], description: 'PDP "FAQ" tab — list of question/answer pairs' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductFaqDto)
  faqs?: ProductFaqDto[];
}
