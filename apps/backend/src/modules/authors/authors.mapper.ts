import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Author, AuthorTranslation } from '@amader/db';
import { ContentStatus, Locale } from '@amader/db';
import { AUTHOR_MAX_SOCIAL, AUTHOR_SOCIAL_ICONS } from '@amader/shared';
import type { AuthorSocialLink } from '@amader/shared';

export type AuthorWithTranslations = Author & {
  translations: AuthorTranslation[];
};

export class AuthorSocialLinkResponseDto {
  @ApiProperty({ enum: AUTHOR_SOCIAL_ICONS })
  icon!: string;

  @ApiProperty()
  url!: string;

  @ApiPropertyOptional()
  label?: string;
}

// `socialLinks` is a Json column, so nothing in the type system guarantees
// what a row actually holds — a value written by the generic settings path,
// an older shape, or hand-edited SQL all land here. Re-validated on read for
// the same reason footer.service.ts re-checks its own config: this array is
// rendered as `href`s on a public page, and the write-side DTO is not the
// only way rows get in.
export function parseAuthorSocialLinks(
  value: unknown,
): AuthorSocialLinkResponseDto[] {
  if (!Array.isArray(value)) return [];
  const icons = AUTHOR_SOCIAL_ICONS as readonly string[];
  return value
    .filter((entry): entry is AuthorSocialLink => {
      if (!entry || typeof entry !== 'object') return false;
      const link = entry as Partial<AuthorSocialLink>;
      return (
        typeof link.icon === 'string' &&
        icons.includes(link.icon) &&
        typeof link.url === 'string' &&
        /^https?:\/\/[^\s]+$/.test(link.url)
      );
    })
    .slice(0, AUTHOR_MAX_SOCIAL)
    .map((link) => ({
      icon: link.icon,
      url: link.url,
      ...(link.label ? { label: link.label } : {}),
    }));
}

export class AdminAuthorTranslationDto {
  @ApiProperty({ enum: Locale })
  locale!: Locale;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  bio!: string | null;
}

export class AdminAuthorDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ nullable: true, type: String })
  photoUrl!: string | null;

  @ApiProperty({ type: [AuthorSocialLinkResponseDto] })
  socialLinks!: AuthorSocialLinkResponseDto[];

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty({ enum: ContentStatus })
  status!: ContentStatus;

  @ApiProperty({ type: [AdminAuthorTranslationDto] })
  translations!: AdminAuthorTranslationDto[];

  /** How many products currently point at this author — the list page uses
   * it to warn before a delete orphans live book pages. */
  @ApiProperty()
  productCount!: number;
}

export function toAdminAuthorDto(
  author: AuthorWithTranslations,
  productCount: number,
): AdminAuthorDto {
  return {
    id: author.id,
    slug: author.slug,
    photoUrl: author.photoUrl,
    socialLinks: parseAuthorSocialLinks(author.socialLinks),
    sortOrder: author.sortOrder,
    status: author.status,
    translations: author.translations.map((t) => ({
      locale: t.locale,
      name: t.name,
      bio: t.bio,
    })),
    productCount,
  };
}

// The shape the storefront's Author tab renders — one locale, resolved.
export class PublicAuthorDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  bio!: string | null;

  @ApiProperty({ nullable: true, type: String })
  photoUrl!: string | null;

  @ApiProperty({ type: [AuthorSocialLinkResponseDto] })
  socialLinks!: AuthorSocialLinkResponseDto[];
}

export function toPublicAuthorDto(
  author: AuthorWithTranslations,
  locale: Locale,
): PublicAuthorDto {
  const translation =
    author.translations.find((t) => t.locale === locale) ??
    author.translations[0];
  return {
    id: author.id,
    slug: author.slug,
    name: translation?.name ?? author.slug,
    bio: translation?.bio ?? null,
    photoUrl: author.photoUrl,
    socialLinks: parseAuthorSocialLinks(author.socialLinks),
  };
}
