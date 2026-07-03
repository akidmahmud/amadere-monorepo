import { ApiProperty } from '@nestjs/swagger';
import { Locale } from '@amader/db';
import { IsEnum, IsOptional, IsString } from 'class-validator';

// Shared shape for entities whose translation table is just {locale, name,
// description?} — Brand/Category/Tag. Product/Bundle have richer fields and
// define their own DTOs.
export class NameDescriptionTranslationDto {
  @ApiProperty({ enum: Locale })
  @IsEnum(Locale)
  locale!: Locale;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
