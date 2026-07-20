import { ApiProperty } from '@nestjs/swagger';
import { Locale } from '@amader/db';
import { IsEnum, IsString, MinLength } from 'class-validator';

export class AnnouncementTranslationDto {
  @ApiProperty({ enum: Locale })
  @IsEnum(Locale)
  locale!: Locale;

  @IsString()
  @MinLength(1)
  message!: string;
}
