import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  registerDecorator,
  ValidateIf,
  ValidateNested,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import {
  FOOTER_ABSOLUTE_URL_OR_EMPTY_PATTERN,
  FOOTER_APP_STYLES,
  FOOTER_HREF_PATTERN,
  FOOTER_MAX_APP_BUTTONS,
  FOOTER_MAX_COLUMNS,
  FOOTER_MAX_SOCIAL,
  FOOTER_SOCIAL_ICONS,
} from '@amader/shared';

// HREF/ABSOLUTE_OR_EMPTY used to be declared here; they now live in
// packages/shared/src/footer.ts as FOOTER_HREF_PATTERN and
// FOOTER_ABSOLUTE_URL_OR_EMPTY_PATTERN so footer.service.ts's merge() can
// enforce the identical rule on read, since the DTO is not the only write
// path into footer_config (see the generic admin settings endpoint).
const HREF = FOOTER_HREF_PATTERN;
const ABSOLUTE_OR_EMPTY = FOOTER_ABSOLUTE_URL_OR_EMPTY_PATTERN;

// A dialable phone number, or empty. Deliberately permissive (no strict
// region format) — `+8801615980394` is today's default, but this is a
// tel: target, not a phone-number-formatting feature; digits, spaces,
// parens, `+` and `-` are all things a dial string can legitimately carry.
const PHONE_OR_EMPTY = /^(|\+?[0-9][0-9\s().-]{5,19})$/;

// A built-in icon renders an inline SVG and must not carry an image; a
// `custom` one has nothing to render without it. Enforced here rather than
// silently ignored, so a malformed save fails loudly at the boundary.
//
// This is the only validator on `mediaId` — no `@IsOptional`/`@IsInt`
// alongside it. `@IsOptional` skips every other validator on the property
// once the value is null/undefined, which would let a `custom` icon with
// `mediaId: null` slip through unchecked. The `typeof value === 'number'`
// check below already covers what `@IsInt` gave for the `custom` case, and
// the null-or-undefined branch covers the built-in case.
function MediaIdMatchesVariant(options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'mediaIdMatchesVariant',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const parent = args.object as { icon?: string; style?: string };
          const variant = parent.icon ?? parent.style;
          return variant === 'custom'
            ? typeof value === 'number'
            : value === null || value === undefined;
        },
        defaultMessage() {
          return 'mediaId is required for a custom icon and must be null otherwise';
        },
      },
    });
  };
}

export class TranslatedDto {
  @ApiProperty()
  @IsDefined()
  @IsString()
  en!: string;

  @ApiProperty()
  @IsDefined()
  @IsString()
  bn!: string;
}

export class FooterLinkDto {
  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  label!: TranslatedDto;

  @ApiProperty({ example: '/about-us' })
  @Matches(HREF, { message: 'href must be a site-relative path or an http(s) URL' })
  href!: string;

  @ApiProperty()
  @IsBoolean()
  newTab!: boolean;
}

export class FooterColumnDto {
  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  heading!: TranslatedDto;

  @ApiProperty({ type: FooterLinkDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FooterLinkDto)
  links!: FooterLinkDto[];
}

export class FooterSocialLinkDto {
  @ApiProperty({ enum: FOOTER_SOCIAL_ICONS })
  @IsIn(FOOTER_SOCIAL_ICONS as unknown as string[])
  icon!: string;

  @ApiProperty({ nullable: true, type: Number })
  @MediaIdMatchesVariant()
  mediaId!: number | null;

  @ApiProperty()
  @Matches(ABSOLUTE_OR_EMPTY, { message: 'url must be an http(s) URL or empty' })
  url!: string;

  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  label!: TranslatedDto;
}

export class FooterAppButtonDto {
  @ApiProperty({ enum: FOOTER_APP_STYLES })
  @IsIn(FOOTER_APP_STYLES as unknown as string[])
  style!: string;

  @ApiProperty({ nullable: true, type: Number })
  @MediaIdMatchesVariant()
  mediaId!: number | null;

  @ApiProperty({ description: 'Empty renders an inert button rather than hiding it' })
  @Matches(ABSOLUTE_OR_EMPTY, { message: 'url must be an http(s) URL or empty' })
  url!: string;

  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  lineOne!: TranslatedDto;

  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  lineTwo!: TranslatedDto;
}

export class TranslatedPairDto {
  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  label!: TranslatedDto;

  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  value!: TranslatedDto;
}

export class FooterPhoneFieldDto {
  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  label!: TranslatedDto;

  @ApiProperty({ description: 'A dialable tel: target; empty string allowed' })
  @Matches(PHONE_OR_EMPTY, { message: 'value must be a dialable phone number or empty' })
  value!: string;
}

export class FooterEmailFieldDto {
  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  label!: TranslatedDto;

  // Empty string allowed — the defaults ship with an empty email — but
  // anything non-empty has to actually be an address, since it becomes a
  // mailto: target.
  @ApiProperty({ description: 'A mailto: target; empty string allowed since the defaults ship with an empty email' })
  @ValidateIf((o: FooterEmailFieldDto) => o.value !== '')
  @IsEmail()
  value!: string;
}

export class FooterContactDto {
  @ApiProperty({ type: TranslatedPairDto })
  @ValidateNested()
  @Type(() => TranslatedPairDto)
  address!: TranslatedPairDto;

  @ApiProperty({ type: FooterPhoneFieldDto })
  @ValidateNested()
  @Type(() => FooterPhoneFieldDto)
  phone!: FooterPhoneFieldDto;

  @ApiProperty({ type: FooterEmailFieldDto })
  @ValidateNested()
  @Type(() => FooterEmailFieldDto)
  email!: FooterEmailFieldDto;

  @ApiProperty({ type: TranslatedPairDto })
  @ValidateNested()
  @Type(() => TranslatedPairDto)
  hours!: TranslatedPairDto;
}

export class FooterAppsDto {
  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  downloadLabel!: TranslatedDto;

  @ApiProperty({ type: FooterAppButtonDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(FOOTER_MAX_APP_BUTTONS)
  @ValidateNested({ each: true })
  @Type(() => FooterAppButtonDto)
  buttons!: FooterAppButtonDto[];
}

export class FooterPaymentDto {
  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  label!: TranslatedDto;

  // No icon/style variant here — a payment badge image is simply optional,
  // unlike social/app-button media which is tied to a `custom` selector.
  @ApiProperty({ nullable: true, type: Number })
  @IsOptional()
  @IsInt()
  mediaId!: number | null;
}

export class FooterLogoDto {
  @ApiProperty({ nullable: true, type: Number, description: 'Null means "use the site logo"' })
  @IsOptional()
  @IsInt()
  mediaId!: number | null;
}

export class UpdateFooterDto {
  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  brandMark!: TranslatedDto;

  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  description!: TranslatedDto;

  @ApiProperty({ type: FooterContactDto })
  @ValidateNested()
  @Type(() => FooterContactDto)
  contact!: FooterContactDto;

  @ApiProperty({ type: FooterSocialLinkDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(FOOTER_MAX_SOCIAL)
  @ValidateNested({ each: true })
  @Type(() => FooterSocialLinkDto)
  social!: FooterSocialLinkDto[];

  @ApiProperty({ type: FooterAppsDto })
  @ValidateNested()
  @Type(() => FooterAppsDto)
  apps!: FooterAppsDto;

  @ApiProperty({ type: FooterColumnDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(FOOTER_MAX_COLUMNS)
  @ValidateNested({ each: true })
  @Type(() => FooterColumnDto)
  columns!: FooterColumnDto[];

  @ApiProperty({ type: FooterPaymentDto })
  @ValidateNested()
  @Type(() => FooterPaymentDto)
  payment!: FooterPaymentDto;

  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  copyright!: TranslatedDto;

  // No icon/style variant here, so the plain @IsOptional/@IsInt pair is
  // correct — unlike the social/app-button mediaId fields, whose custom
  // validator @IsOptional would have silently short-circuited.
  @ApiProperty({ type: FooterLogoDto })
  @ValidateNested()
  @Type(() => FooterLogoDto)
  logo!: FooterLogoDto;
}
