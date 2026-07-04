import { ApiProperty } from '@nestjs/swagger';
import { Locale } from '@amader/db';
import { IsEnum, IsString } from 'class-validator';

// BlogTagTranslation is name-only (no description column), unlike the
// product-catalog Tag — a dedicated shape instead of forcing the shared
// NameDescriptionTranslationDto onto a column that doesn't exist.
export class NameTranslationDto {
  @ApiProperty({ enum: Locale })
  @IsEnum(Locale)
  locale!: Locale;

  @ApiProperty()
  @IsString()
  name!: string;
}
