import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentStatus, Locale } from '@amader/db';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { AUTHOR_MAX_SOCIAL, AUTHOR_SOCIAL_ICONS } from '@amader/shared';

export class AuthorTranslationDto {
  @ApiProperty({ enum: Locale })
  @IsEnum(Locale)
  locale!: Locale;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;
}

export class AuthorSocialLinkDto {
  @ApiProperty({ enum: AUTHOR_SOCIAL_ICONS })
  @IsIn(AUTHOR_SOCIAL_ICONS as readonly string[])
  icon!: string;

  // Absolute http(s) only — these land in an `href` on a public page, so a
  // `javascript:`/`data:` URL typed into the admin must not survive. Same
  // rule the footer's own social links enforce.
  @ApiProperty()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;
}

export class CreateAuthorDto {
  @ApiProperty()
  @IsString()
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ type: [AuthorSocialLinkDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(AUTHOR_MAX_SOCIAL)
  @ValidateNested({ each: true })
  @Type(() => AuthorSocialLinkDto)
  socialLinks?: AuthorSocialLinkDto[];

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({
    enum: ContentStatus,
    default: ContentStatus.PUBLISHED,
  })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @ApiProperty({ type: [AuthorTranslationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AuthorTranslationDto)
  translations!: AuthorTranslationDto[];
}
