import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Locale } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { FeedBuildResult, FeedItem } from './catalog-feed.types';

/** Google rejects a description under 30 characters. */
const MIN_DESCRIPTION = 30;
/** Meta truncates past 150; better to send something deliberate. */
const MAX_TITLE = 150;
/** Meta accepts up to 20 additional images; more is wasted payload. */
const MAX_EXTRA_IMAGES = 10;

@Injectable()
export class CatalogFeedService {
  private readonly logger = new Logger(CatalogFeedService.name);

  /**
   * The whole feed, cached in memory.
   *
   * Rebuilding walks every published product with its variants, media,
   * brand and categories — cheap at this catalogue's size but not something
   * to repeat for each of the three platform URLs, which are all fetched
   * within moments of each other. Invalidated on any product write (see
   * `invalidate`) and rebuilt on a schedule as a fallback.
   */
  private cache: FeedBuildResult | null = null;
  /** Coalesces concurrent misses so three simultaneous fetches do one query. */
  private inFlight: Promise<FeedBuildResult> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Dropped by the product observer and the cron job. */
  invalidate(): void {
    this.cache = null;
  }

  get lastGeneratedAt(): Date | null {
    return this.cache?.generatedAt ?? null;
  }

  async get(locale: Locale = 'EN'): Promise<FeedBuildResult> {
    if (this.cache) return this.cache;
    // Without this, the first request after an invalidation from Meta,
    // Google and TikTok arriving together would run the same query three
    // times concurrently and all three would write the cache.
    this.inFlight ??= this.build(locale).finally(() => {
      this.inFlight = null;
    });
    this.cache = await this.inFlight;
    return this.cache;
  }

  async rebuild(locale: Locale = 'EN'): Promise<FeedBuildResult> {
    this.invalidate();
    return this.get(locale);
  }

  /** Public storefront origin — also the Google feed's <link>. */
  get shopUrl(): string {
    return this.baseUrl();
  }

  private baseUrl(): string {
    return (
      this.config.get<string>('STOREFRONT_BASE_URL') ?? 'https://amadere.com'
    ).replace(/\/+$/, '');
  }

  private async build(locale: Locale): Promise<FeedBuildResult> {
    const started = Date.now();
    const products = await this.prisma.client.product.findMany({
      where: {
        deletedAt: null,
        status: 'PUBLISHED',
        excludeFromFeed: false,
      },
      select: {
        id: true,
        slug: true,
        sku: true,
        productType: true,
        stockStatus: true,
        googleProductCategory: true,
        customLabels: true,
        price: true,
        salePrice: true,
        // Both locales, so a product translated in only one still gets a row
        // rather than being silently dropped from the catalogue.
        translations: { select: { locale: true, name: true, description: true } },
        brand: { select: { translations: { select: { locale: true, name: true } } } },
        variants: {
          select: { id: true, sku: true, price: true, salePrice: true, isDefault: true },
          orderBy: { id: 'asc' },
        },
        media: {
          where: { media: { type: { not: 'VIDEO' } } },
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          select: { media: { select: { url: true, fullUrl: true } } },
        },
        categories: {
          select: { category: { select: { translations: { select: { locale: true, name: true } } } } },
        },
      },
      orderBy: { id: 'asc' },
    });

    const base = this.baseUrl();
    const items: FeedItem[] = [];
    const skipped: Record<string, number> = {};
    const shortDescription: number[] = [];
    const noImage: number[] = [];

    const pick = <T extends { locale: Locale }>(rows: T[]): T | undefined =>
      rows.find((r) => r.locale === locale) ?? rows[0];

    for (const p of products) {
      const t = pick(p.translations);
      const title = t?.name?.trim();
      if (!title) {
        skipped['No name in any locale'] = (skipped['No name in any locale'] ?? 0) + 1;
        continue;
      }

      // Same price rule as the storefront's product cards and GA4 items: the
      // default variant, or the first one, falling back to the product's own
      // price for products that carry no variants at all. A row priced 0
      // would be rejected anyway, so it is skipped rather than sent.
      const variant = p.variants.find((v) => v.isDefault) ?? p.variants[0];
      const price = Number(variant?.price ?? p.price ?? 0);
      if (!price) {
        skipped['No price'] = (skipped['No price'] ?? 0) + 1;
        continue;
      }
      const saleRaw = Number(variant?.salePrice ?? p.salePrice ?? 0);
      const salePrice = saleRaw > 0 && saleRaw < price ? saleRaw : undefined;

      const images = p.media
        .map((m) => m.media.fullUrl ?? m.media.url)
        .filter((u): u is string => !!u);
      if (images.length === 0) noImage.push(p.id);

      const description = (t?.description ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (description.length < MIN_DESCRIPTION) shortDescription.push(p.id);

      items.push({
        id: String(p.id),
        title: title.slice(0, MAX_TITLE),
        // Falls back to the title rather than inventing copy. Still flagged
        // above, because Google will reject it — the fix is real product
        // copy, not something this service should fabricate.
        description: description || title,
        availability:
          p.stockStatus === 'OUT_OF_STOCK'
            ? 'out of stock'
            : p.stockStatus === 'ON_BACKORDER'
              ? 'preorder'
              : 'in stock',
        condition: 'new',
        price,
        salePrice,
        link: `${base}/products/${p.slug}`,
        imageLink: images[0],
        additionalImageLinks: images.slice(1, 1 + MAX_EXTRA_IMAGES),
        brand: pick(p.brand?.translations ?? [])?.name?.trim() || 'Amader',
        googleProductCategory: p.googleProductCategory ?? undefined,
        productType:
          p.categories
            .map((c) => pick(c.category.translations)?.name)
            .filter(Boolean)
            .join(' > ') || undefined,
        itemGroupId: p.slug,
        mpn: variant?.sku ?? p.sku ?? undefined,
        customLabels: p.customLabels,
        shippable: p.productType === 'PHYSICAL',
      });
    }

    // Built up rather than filtered out of an array of `false | {...}` — the
    // predicate form does not narrow to the DTO type and TS rejects it.
    const warnings: FeedBuildResult['warnings'] = [];
    if (shortDescription.length > 0) {
      warnings.push({
        reason: `Description under ${MIN_DESCRIPTION} characters — Google will reject these`,
        count: shortDescription.length,
        productIds: shortDescription.slice(0, 50),
      });
    }
    if (noImage.length > 0) {
      warnings.push({
        reason: 'No image — every platform requires one',
        count: noImage.length,
        productIds: noImage.slice(0, 50),
      });
    }

    const result: FeedBuildResult = {
      items,
      generatedAt: new Date(),
      skipped: Object.entries(skipped).map(([reason, count]) => ({ reason, count })),
      warnings,
    };

    this.logger.log(
      `Catalog feed built: ${items.length} products in ${Date.now() - started}ms`,
    );
    return result;
  }
}
