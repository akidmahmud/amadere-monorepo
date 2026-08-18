import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Locale, SeoEntityType } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpsertSeoMetaDto } from './dto/upsert-seo-meta.dto';
import { ResolvedSeoDto, SeoMetaDto, toSeoMetaDto } from './seo.mapper';

export interface SeoFallback {
  title: string;
  description?: string | null;
  canonicalPath: string;
  imageUrl?: string | null;
}

// `description` fallbacks are frequently a product/post/page's own
// CKEditor-authored rich-text field (e.g. products.service.ts passes
// `dto.description`, straight from the translation row) — used raw, that
// puts literal `<p>`/`<strong>` tags into <meta name="description">,
// og:description, and search-engine/link-preview snippets. Meta
// descriptions are always plain text, never HTML, so every description-
// shaped field this service returns goes through this first.
// ponytail: regex strip, not a full HTML parser — good enough for
// well-formed editor output, matches content.util.ts's own stripHtml.
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable()
export class SeoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async adminGet(
    entityType: SeoEntityType,
    entityId: number,
    locale: Locale,
  ): Promise<SeoMetaDto> {
    const meta = await this.prisma.client.seoMeta.findUnique({
      where: { entityType_entityId_locale: { entityType, entityId, locale } },
    });
    if (!meta)
      throw new NotFoundException('No SEO meta set for this entity/locale');
    return toSeoMetaDto(meta);
  }

  async adminUpsert(dto: UpsertSeoMetaDto): Promise<SeoMetaDto> {
    const meta = await this.prisma.client.seoMeta.upsert({
      where: {
        entityType_entityId_locale: {
          entityType: dto.entityType,
          entityId: dto.entityId,
          locale: dto.locale,
        },
      },
      create: dto,
      update: {
        title: dto.title,
        description: dto.description,
        canonicalUrl: dto.canonicalUrl,
        robots: dto.robots,
        ogTitle: dto.ogTitle,
        ogDescription: dto.ogDescription,
        ogImageUrl: dto.ogImageUrl,
        structuredDataType: dto.structuredDataType,
      },
    });
    return toSeoMetaDto(meta);
  }

  // Shared with structured-data builders (breadcrumbs, etc.) so every
  // absolute URL in a response is built the same way.
  absoluteUrl(path: string): string {
    return `${this.config.get<string>('STOREFRONT_BASE_URL') ?? ''}${path}`;
  }

  async adminDelete(
    entityType: SeoEntityType,
    entityId: number,
    locale: Locale,
  ): Promise<void> {
    await this.prisma.client.seoMeta
      .delete({
        where: { entityType_entityId_locale: { entityType, entityId, locale } },
      })
      .catch(() => {
        throw new NotFoundException('No SEO meta set for this entity/locale');
      });
  }

  // Used by every public detail endpoint (products, categories, brands, ...)
  // to merge an admin-authored SeoMeta override with sensible defaults
  // derived from the entity's own content, so the frontend always gets a
  // complete SEO block regardless of whether an admin has touched it yet.
  async resolve(
    entityType: SeoEntityType,
    entityId: number,
    locale: Locale,
    fallback: SeoFallback,
  ): Promise<ResolvedSeoDto> {
    const meta = await this.prisma.client.seoMeta.findUnique({
      where: { entityType_entityId_locale: { entityType, entityId, locale } },
    });

    const baseUrl = this.config.get<string>('STOREFRONT_BASE_URL') ?? '';
    const canonicalUrl =
      meta?.canonicalUrl ?? `${baseUrl}${fallback.canonicalPath}`;
    const title = meta?.title ?? fallback.title;
    const description = meta?.description ?? fallback.description ?? null;
    const ogDescription = meta?.ogDescription ?? description;

    return {
      title,
      description: description ? stripHtml(description) : null,
      canonicalUrl,
      robots: meta?.robots ?? 'index,follow',
      ogTitle: meta?.ogTitle ?? title,
      ogDescription: ogDescription ? stripHtml(ogDescription) : null,
      ogImageUrl: meta?.ogImageUrl ?? fallback.imageUrl ?? null,
    };
  }
}
