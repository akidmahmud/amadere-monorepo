import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Locale } from '@amader/db';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { BlogPostFaqDto } from './blog-post-faq.dto';

export class BlogPostTranslationDto {
  @ApiProperty({ enum: Locale })
  @IsEnum(Locale)
  locale!: Locale;

  @ApiProperty()
  @IsString()
  title!: string;

  // Admin's Excerpt field shows a "X/400" counter next to it — the frontend
  // also caps the textarea's `maxLength` at 400, but this is the real
  // enforcement (a direct API call could otherwise still bypass it).
  @ApiPropertyOptional({ maxLength: 400 })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  excerpt?: string;

  @ApiProperty()
  @IsString()
  content!: string;

  // Optional "Reference" section (sources/citations) — rich HTML rendered
  // after the FAQ on the post page.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  metaDescription?: string;

  @ApiPropertyOptional({ type: [BlogPostFaqDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlogPostFaqDto)
  faqs?: BlogPostFaqDto[];
}
