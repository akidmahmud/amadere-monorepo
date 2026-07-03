import { ApiPropertyOptional } from '@nestjs/swagger';
import { Locale } from '@amader/db';
import { IsEnum, IsOptional } from 'class-validator';

export class LocaleQueryDto {
  @ApiPropertyOptional({ enum: Locale, default: Locale.EN })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.EN;
}
