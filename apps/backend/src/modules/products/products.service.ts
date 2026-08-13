import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ContentStatus, Locale, Prisma, SeoEntityType } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginationArgs,
  toPaginatedResult,
} from '../../common/pagination.util';
import { PRODUCT_INCLUDE } from './product-includes';
import { toAdminProductDto, toPublicProductDto } from './products.mapper';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { ProductTranslationDto } from './dto/product-translation.dto';
import { ProductFilterQueryDto, ProductSort } from './dto/product-filter-query.dto';
import { AdminProductQueryDto } from './dto/admin-product-query.dto';
import { computeSeoScore } from './seo-score.util';
import {
  AdminDeletedProductDto,
  AdminProductDto,
  AdminProductPickerItemDto,
  PublicProductDetailDto,
  PublicProductDto,
} from './dto/product-response.dto';
import { SeoService } from '../seo/seo.service';
import { ReviewsService } from '../reviews/reviews.service';
import { TokenService } from '../../common/auth/token.service';
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildProductJsonLd,
  buildVideoObjectJsonLd,
} from '../../common/structured-data/structured-data.util';

export interface CsvImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { line: number; reason: string }[];
}

// Minimal hand-rolled parser, same shape as newsletter.service.ts's own —
// this format (adminExportCsv's own header) has no embedded newlines to
// justify a real CSV library (ponytail: ~25 lines beats a dependency).
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly seo: SeoService,
    private readonly reviews: ReviewsService,
    private readonly tokens: TokenService,
  ) {}

  async adminList(
    page: number,
    pageSize: number,
    filters: AdminProductQueryDto,
  ): Promise<PaginatedResult<AdminProductDto>> {
    const where = this.buildAdminWhere(filters);
    const [items, total] = await Promise.all([
      this.prisma.client.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.product.count({ where }),
    ]);
    const seoMetaByProductId = await this.fetchSeoMetaMap(items.map((p) => p.id));
    return toPaginatedResult(
      items.map((p) => ({
        ...toAdminProductDto(p),
        createdAt: p.createdAt,
        seoScore: computeSeoScore({
          metaTitle: seoMetaByProductId.get(p.id)?.title,
          metaDescription: seoMetaByProductId.get(p.id)?.description,
          slug: p.slug,
          primaryImageAlt: p.media.find((m) => m.isPrimary)?.media.altText ?? p.media[0]?.media.altText,
          description: p.translations[0]?.description,
        }),
      })),
      total,
      page,
      pageSize,
    );
  }

  // Deliberately bypasses PRODUCT_INCLUDE/adminList — pickers (collection
  // editor, cross-sell, etc.) only ever render a checkbox list of names, but
  // were reusing the full admin list query, which pulls every variant's
  // attribute values and every category/tag/attribute's translations for
  // every row. That's fine for the real Products page (which needs it), but
  // made a 100-row picker genuinely slow to load once the catalog grew past
  // a handful of products.
  async adminPickerList(): Promise<AdminProductPickerItemDto[]> {
    const products = await this.prisma.client.product.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        slug: true,
        translations: { select: { name: true }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return products.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.translations[0]?.name ?? p.slug,
    }));
  }

  // Every distinct SEO_META row for the given products in one query — avoids
  // an N+1 (one lookup per row) on a list page that can show 20+ products.
  private async fetchSeoMetaMap(
    productIds: number[],
  ): Promise<Map<number, { title: string | null; description: string | null }>> {
    if (productIds.length === 0) return new Map();
    const rows = await this.prisma.client.seoMeta.findMany({
      where: { entityType: SeoEntityType.PRODUCT, entityId: { in: productIds }, locale: Locale.EN },
      select: { entityId: true, title: true, description: true },
    });
    return new Map(rows.map((r) => [r.entityId, { title: r.title, description: r.description }]));
  }

  // Low-stock threshold: a fixed constant, not a configurable setting — no
  // UI has asked to make this adjustable yet, and the only other
  // low-stock-threshold concept in this codebase belongs to the optional
  // Net Profit module, which core Products should not depend on.
  private static readonly LOW_STOCK_THRESHOLD = 10;

  async adminStats(): Promise<{
    total: number;
    active: number;
    draft: number;
    outOfStock: number;
    lowStock: number;
  }> {
    const base = { deletedAt: null } as const;
    const [total, active, draft, outOfStock, lowStock] = await Promise.all([
      this.prisma.client.product.count({ where: base }),
      this.prisma.client.product.count({ where: { ...base, status: 'PUBLISHED' } }),
      this.prisma.client.product.count({ where: { ...base, status: 'DRAFT' } }),
      this.prisma.client.product.count({ where: { ...base, stockStatus: 'OUT_OF_STOCK' } }),
      this.prisma.client.product.count({
        where: { ...base, stock: { gt: 0, lte: ProductsService.LOW_STOCK_THRESHOLD } },
      }),
    ]);
    return { total, active, draft, outOfStock, lowStock };
  }

  // Real per-product sales figures for the Add/Edit form's Analytics tab —
  // no view/conversion tracking exists in this codebase, so this only
  // surfaces what we actually have (units sold, revenue, order count),
  // same NON_CANCELED convention as the dashboard endpoint.
  async adminStatsFor(productId: number): Promise<{ unitsSold: number; revenue: string; orderCount: number }> {
    const items = await this.prisma.client.orderItem.findMany({
      where: { productId, order: { status: { not: 'CANCELED' } } },
      select: { quantity: true, unitPrice: true, orderId: true },
    });
    const unitsSold = items.reduce((sum, i) => sum + i.quantity, 0);
    const revenue = items.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);
    const orderCount = new Set(items.map((i) => i.orderId)).size;
    return { unitsSold, revenue: revenue.toFixed(2), orderCount };
  }

  async adminExportCsv(filters: AdminProductQueryDto): Promise<string> {
    const where = this.buildAdminWhere(filters);
    const items = await this.prisma.client.product.findMany({
      where,
      include: PRODUCT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 10_000,
    });
    const header = 'Name,Slug,SKU,Category,Stock,Price,Status,Created At';
    const lines = items.map((p) => {
      const name = p.translations[0]?.name ?? p.slug;
      const category = p.categories[0]?.category.translations[0]?.name ?? '';
      return `"${name}",${p.slug},${p.sku ?? ''},"${category}",${p.stock},${p.price ?? ''},${p.status},${p.createdAt.toISOString().slice(0, 10)}`;
    });
    return [header, ...lines].join('\n');
  }

  // Same column order adminExportCsv writes, so export -> edit -> re-import
  // round-trips. Upserts by slug: existing slug updates stock/price/status/
  // sku/category, new slug creates a plain (no-variant) product. Category is
  // matched by exact name against *existing* categories only — never
  // auto-created, to avoid silently growing the taxonomy from typos; an
  // unmatched name still imports the row, just uncategorized, reported as a
  // non-fatal error line.
  async importCsv(csv: string): Promise<CsvImportResult> {
    const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const result: CsvImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
    if (lines.length === 0) return result;

    const firstRow = parseCsvLine(lines[0]).map((f) => f.trim().toLowerCase());
    const hasHeader = firstRow[0] === 'name';
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const headerOffset = hasHeader ? 1 : 0;

    for (let i = 0; i < dataLines.length; i++) {
      const lineNumber = i + headerOffset + 1;
      const [name, slug, sku, category, stockRaw, priceRaw, statusRaw] = parseCsvLine(dataLines[i]).map((f) => f.trim());

      if (!name || !slug) {
        result.errors.push({ line: lineNumber, reason: 'Missing Name or Slug' });
        result.skipped++;
        continue;
      }

      let stock: number | undefined;
      if (stockRaw) {
        stock = Number.parseInt(stockRaw, 10);
        if (Number.isNaN(stock)) {
          result.errors.push({ line: lineNumber, reason: `Invalid Stock "${stockRaw}"` });
          result.skipped++;
          continue;
        }
      }

      let price: number | undefined;
      if (priceRaw) {
        price = Number.parseFloat(priceRaw);
        if (Number.isNaN(price)) {
          result.errors.push({ line: lineNumber, reason: `Invalid Price "${priceRaw}"` });
          result.skipped++;
          continue;
        }
      }

      let status: ContentStatus | undefined;
      if (statusRaw) {
        const match = Object.values(ContentStatus).find((s) => s === statusRaw.toUpperCase());
        if (!match) {
          result.errors.push({ line: lineNumber, reason: `Invalid Status "${statusRaw}"` });
          result.skipped++;
          continue;
        }
        status = match;
      }

      let categoryId: number | undefined;
      if (category) {
        const match = await this.prisma.client.categoryTranslation.findFirst({
          where: { name: { equals: category, mode: 'insensitive' } },
        });
        if (match) categoryId = match.categoryId;
        else result.errors.push({ line: lineNumber, reason: `Category "${category}" not found — imported uncategorized` });
      }

      try {
        const existing = await this.prisma.client.product.findFirst({ where: { slug } });
        if (existing) {
          if (categoryId !== undefined) {
            await this.prisma.client.productCategory.deleteMany({ where: { productId: existing.id } });
          }
          await this.prisma.client.product.update({
            where: { id: existing.id },
            data: {
              sku: sku || undefined,
              stock,
              price,
              status,
              categories: categoryId !== undefined ? { create: [{ categoryId }] } : undefined,
            },
          });
          result.updated++;
        } else {
          await this.prisma.client.product.create({
            data: {
              slug,
              sku: sku || undefined,
              stock: stock ?? 0,
              price,
              status,
              translations: { create: [{ locale: Locale.EN, name }] },
              categories: categoryId !== undefined ? { create: [{ categoryId }] } : undefined,
            },
          });
          result.created++;
        }
      } catch (e) {
        result.errors.push({ line: lineNumber, reason: e instanceof Error ? e.message : 'Unknown error' });
        result.skipped++;
      }
    }
    return result;
  }

  private buildAdminWhere(filters: AdminProductQueryDto) {
    return {
      ...this.buildWhere(filters, { deletedAt: null }),
      ...(filters.status !== undefined ? { status: filters.status } : {}),
      ...(filters.stockStatus !== undefined ? { stockStatus: filters.stockStatus } : {}),
      ...(filters.createdFrom || filters.createdTo
        ? {
            createdAt: {
              ...(filters.createdFrom ? { gte: new Date(filters.createdFrom) } : {}),
              ...(filters.createdTo ? { lte: new Date(filters.createdTo) } : {}),
            },
          }
        : {}),
    };
  }

  async adminGet(id: number): Promise<AdminProductDto> {
    const product = await this.prisma.client.product.findFirst({
      where: { id, deletedAt: null },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException('Product not found');
    return toAdminProductDto(product);
  }

  async create(dto: CreateProductDto): Promise<AdminProductDto> {
    await this.assertSlugAvailable(dto.slug);
    await this.validateReferences(dto);
    this.validatePricingShape(dto);
    if (dto.hasVariants)
      await this.validateVariantAttributeValues(
        dto.attributeIds ?? [],
        dto.variants!,
      );

    const product = await this.prisma.client.product.create({
      data: {
        slug: dto.slug,
        sku: dto.sku,
        brandId: dto.brandId,
        productType: dto.productType,
        status: dto.status,
        isFeatured: dto.isFeatured,
        flagLabel: dto.flagLabel,
        videoUrl: dto.videoUrl,
        hasVariants: dto.hasVariants,
        trackInventory: dto.trackInventory,
        allowBackorder: dto.allowBackorder,
        stock: dto.hasVariants ? 0 : dto.stock,
        stockStatus: dto.stockStatus,
        price: dto.hasVariants ? undefined : dto.price,
        salePrice: dto.salePrice,
        // dto values are bare "YYYY-MM-DD" from <input type="date">, not
        // full ISO-8601 datetimes — Prisma 7's DateTime scalar rejects a
        // date-only string outright ("premature end of input. Expected
        // ISO-8601 DateTime"), so this 500'd on every save that touched
        // either field. new Date(...) normalizes to midnight UTC first.
        saleStartsAt: dto.saleStartsAt ? new Date(dto.saleStartsAt) : dto.saleStartsAt,
        saleEndsAt: dto.saleEndsAt ? new Date(dto.saleEndsAt) : dto.saleEndsAt,
        costPerItem: dto.costPerItem,
        shippableWeight: dto.shippableWeight,
        minOrderQuantity: dto.minOrderQuantity,
        maxOrderQuantity: dto.maxOrderQuantity,
        translations: {
          create: dto.translations.map((t) => ({
            locale: t.locale,
            name: t.name,
            description: t.description,
            content: t.content,
            keyBenefits: t.keyBenefits,
            benefitPoints: t.benefitPoints,
            howToUse: t.howToUse,
            faqs: t.faqs ? { create: t.faqs } : undefined,
          })),
        },
        categories: dto.categoryIds
          ? { create: dto.categoryIds.map((categoryId) => ({ categoryId })) }
          : undefined,
        tags: dto.tagIds
          ? { create: dto.tagIds.map((tagId) => ({ tagId })) }
          : undefined,
        attributes: dto.attributeIds
          ? { create: dto.attributeIds.map((attributeId) => ({ attributeId })) }
          : undefined,
        media: dto.mediaIds
          ? {
              create: dto.mediaIds.map((mediaId, index) => ({
                mediaId,
                sortOrder: index,
                isPrimary: index === 0,
              })),
            }
          : undefined,
        variants: dto.hasVariants
          ? {
              create: dto.variants!.map((v) => ({
                sku: v.sku,
                barcode: v.barcode,
                price: v.price,
                salePrice: v.salePrice,
                stock: v.stock,
                weightOverride: v.weightOverride,
                isDefault: v.isDefault,
                attributeValues: {
                  create: v.attributeValueIds.map((attributeValueId) => ({
                    attributeValueId,
                  })),
                },
              })),
            }
          : undefined,
      },
      include: PRODUCT_INCLUDE,
    });
    return toAdminProductDto(product);
  }

  async update(id: number, dto: UpdateProductDto): Promise<AdminProductDto> {
    await this.adminGet(id);
    if (dto.slug) await this.assertSlugAvailable(dto.slug, id);
    await this.validateReferences(dto);

    if (dto.categoryIds) {
      await this.prisma.client.productCategory.deleteMany({
        where: { productId: id },
      });
    }
    if (dto.tagIds) {
      await this.prisma.client.productTag.deleteMany({
        where: { productId: id },
      });
    }
    if (dto.attributeIds) {
      await this.prisma.client.productAttribute.deleteMany({
        where: { productId: id },
      });
    }
    if (dto.mediaIds) {
      await this.prisma.client.productMedia.deleteMany({
        where: { productId: id },
      });
    }
    if (dto.translations) {
      await this.prisma.client.productTranslation.deleteMany({
        where: { productId: id },
      });
    }

    const product = await this.prisma.client.product.update({
      where: { id },
      data: {
        slug: dto.slug,
        sku: dto.sku,
        brandId: dto.brandId,
        productType: dto.productType,
        status: dto.status,
        isFeatured: dto.isFeatured,
        flagLabel: dto.flagLabel,
        videoUrl: dto.videoUrl,
        trackInventory: dto.trackInventory,
        allowBackorder: dto.allowBackorder,
        stock: dto.stock,
        stockStatus: dto.stockStatus,
        price: dto.price,
        salePrice: dto.salePrice,
        // dto values are bare "YYYY-MM-DD" from <input type="date">, not
        // full ISO-8601 datetimes — Prisma 7's DateTime scalar rejects a
        // date-only string outright ("premature end of input. Expected
        // ISO-8601 DateTime"), so this 500'd on every save that touched
        // either field. new Date(...) normalizes to midnight UTC first.
        saleStartsAt: dto.saleStartsAt ? new Date(dto.saleStartsAt) : dto.saleStartsAt,
        saleEndsAt: dto.saleEndsAt ? new Date(dto.saleEndsAt) : dto.saleEndsAt,
        costPerItem: dto.costPerItem,
        shippableWeight: dto.shippableWeight,
        minOrderQuantity: dto.minOrderQuantity,
        maxOrderQuantity: dto.maxOrderQuantity,
        translations: dto.translations
          ? {
              create: dto.translations.map((t) => ({
                locale: t.locale,
                name: t.name,
                description: t.description,
                content: t.content,
                keyBenefits: t.keyBenefits,
                benefitPoints: t.benefitPoints,
                howToUse: t.howToUse,
                faqs: t.faqs ? { create: t.faqs } : undefined,
              })),
            }
          : undefined,
        categories: dto.categoryIds
          ? { create: dto.categoryIds.map((categoryId) => ({ categoryId })) }
          : undefined,
        tags: dto.tagIds
          ? { create: dto.tagIds.map((tagId) => ({ tagId })) }
          : undefined,
        attributes: dto.attributeIds
          ? { create: dto.attributeIds.map((attributeId) => ({ attributeId })) }
          : undefined,
        media: dto.mediaIds
          ? {
              create: dto.mediaIds.map((mediaId, index) => ({
                mediaId,
                sortOrder: index,
                isPrimary: index === 0,
              })),
            }
          : undefined,
      },
      include: PRODUCT_INCLUDE,
    });
    return toAdminProductDto(product);
  }

  async delete(id: number): Promise<void> {
    await this.adminGet(id);
    await this.prisma.client.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private static readonly TRASH_RETENTION_DAYS = 30;

  // Trash listing — soft-deleted products still within the retention window
  // (the nightly purge job below removes anything older, so `deletedAt: not
  // null` alone is equivalent to "within 30 days" in practice).
  async listDeleted(page = 1, pageSize = 20): Promise<PaginatedResult<AdminDeletedProductDto>> {
    const where = { deletedAt: { not: null } };
    const [total, products] = await Promise.all([
      this.prisma.client.product.count({ where }),
      this.prisma.client.product.findMany({
        where,
        select: {
          id: true,
          slug: true,
          deletedAt: true,
          translations: { select: { name: true }, take: 1 },
          media: { orderBy: { sortOrder: 'asc' }, take: 1, select: { media: { select: { url: true } } } },
        },
        orderBy: { deletedAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
    ]);

    const items = products.map((p) => {
      const deletedAt = p.deletedAt!;
      const daysElapsed = Math.floor((Date.now() - deletedAt.getTime()) / 86_400_000);
      return {
        id: p.id,
        slug: p.slug,
        name: p.translations[0]?.name ?? p.slug,
        imageUrl: p.media[0]?.media.url ?? null,
        deletedAt,
        daysRemaining: Math.max(0, ProductsService.TRASH_RETENTION_DAYS - daysElapsed),
      };
    });
    return toPaginatedResult(items, total, page, pageSize);
  }

  async restore(id: number): Promise<AdminProductDto> {
    const product = await this.prisma.client.product.findUnique({
      where: { id },
      select: { deletedAt: true },
    });
    if (!product || product.deletedAt === null) {
      throw new NotFoundException('Product not found in trash');
    }
    await this.prisma.client.product.update({
      where: { id },
      data: { deletedAt: null },
    });
    return this.adminGet(id);
  }

  // Runs daily — anything soft-deleted more than 30 days ago is gone for
  // good. Safe to hard-delete: OrderItem.productId is onDelete: SetNull and
  // already carries its own productNameSnapshot/skuSnapshot, so historical
  // orders keep displaying correctly with no live Product row behind them.
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredTrash(): Promise<number> {
    const cutoff = new Date(Date.now() - ProductsService.TRASH_RETENTION_DAYS * 86_400_000);
    const { count } = await this.prisma.client.product.deleteMany({
      where: { deletedAt: { lt: cutoff } },
    });
    if (count > 0) this.logger.log(`Purged ${count} product(s) from trash (past 30-day retention).`);
    return count;
  }

  // Variants are managed one at a time (not wholesale-replaced on product
  // update) so existing CartItem/OrderItem references never get silently
  // orphaned by a bulk delete+recreate.
  async addVariant(
    productId: number,
    dto: CreateProductVariantDto,
  ): Promise<AdminProductDto> {
    const product = await this.prisma.client.product.findFirst({
      where: { id: productId, deletedAt: null },
      include: { attributes: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    await this.validateVariantAttributeValues(
      product.attributes.map((a) => a.attributeId),
      [dto],
    );

    await this.prisma.client.productVariant.create({
      data: {
        productId,
        sku: dto.sku,
        barcode: dto.barcode,
        price: dto.price,
        salePrice: dto.salePrice,
        stock: dto.stock,
        stockStatus: (dto.stock ?? 0) > 0 ? 'IN_STOCK' : product.allowBackorder ? 'ON_BACKORDER' : 'OUT_OF_STOCK',
        weightOverride: dto.weightOverride,
        isDefault: dto.isDefault,
        attributeValues: {
          create: dto.attributeValueIds.map((attributeValueId) => ({
            attributeValueId,
          })),
        },
      },
    });
    if (!product.hasVariants) {
      await this.prisma.client.product.update({
        where: { id: productId },
        data: { hasVariants: true },
      });
    }
    await this.syncParentStockStatus(productId);
    return this.adminGet(productId);
  }

  async removeVariant(productId: number, variantId: number): Promise<void> {
    const variant = await this.prisma.client.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    const usage = await this.prisma.client.orderItem.count({
      where: { variantId },
    });
    if (usage > 0)
      throw new ConflictException(
        'Variant has order history and cannot be deleted',
      );
    await this.prisma.client.productVariant.delete({
      where: { id: variantId },
    });
    await this.syncParentStockStatus(productId);
  }

  // ADDENDUM §B1 — the Inventory view needs to edit variant stock inline;
  // simple (non-variant) products already go through the general update().
  // Unlike update() (where staff set stock and stockStatus together as an
  // explicit pair), this endpoint's callers only ever pass a number — so
  // stockStatus must be derived here, or it silently goes stale (this was a
  // real bug: stock could drop to 0 while a stale IN_STOCK pill stayed put,
  // since nothing ever recomputed it after variant creation).
  async updateVariantStock(
    productId: number,
    variantId: number,
    stock: number,
  ): Promise<void> {
    const variant = await this.prisma.client.productVariant.findFirst({
      where: { id: variantId, productId },
      include: { product: { select: { allowBackorder: true } } },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    const stockStatus =
      stock > 0 ? 'IN_STOCK' : variant.product.allowBackorder ? 'ON_BACKORDER' : 'OUT_OF_STOCK';
    await this.prisma.client.productVariant.update({
      where: { id: variantId },
      data: { stock, stockStatus },
    });
    await this.syncParentStockStatus(productId);
  }

  // The parent Product row's own stockStatus represents "is any variant
  // available" for a hasVariants product (its own `stock` column is a
  // meaningless placeholder in that case, real stock lives per-variant) —
  // recomputed after every variant stock change so the product-list pill
  // never goes stale the way it silently did before this method existed.
  private async syncParentStockStatus(productId: number): Promise<void> {
    const [anyInStock, product] = await Promise.all([
      this.prisma.client.productVariant.findFirst({ where: { productId, stock: { gt: 0 } } }),
      this.prisma.client.product.findUniqueOrThrow({ where: { id: productId }, select: { allowBackorder: true } }),
    ]);
    const stockStatus = anyInStock ? 'IN_STOCK' : product.allowBackorder ? 'ON_BACKORDER' : 'OUT_OF_STOCK';
    await this.prisma.client.product.update({ where: { id: productId }, data: { stockStatus } });
  }

  // Editable in place (like price/stock) rather than requiring remove+re-add
  // — unlike attribute-value combos/isDefault, SKU carries no relational
  // structure that a bare update could leave inconsistent.
  async updateVariantSku(
    productId: number,
    variantId: number,
    sku?: string,
  ): Promise<void> {
    const variant = await this.prisma.client.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    const normalized = sku?.trim() || null;
    if (normalized) {
      const existing = await this.prisma.client.productVariant.findUnique({
        where: { sku: normalized },
      });
      if (existing && existing.id !== variantId) {
        throw new ConflictException(`SKU "${normalized}" is already in use`);
      }
    }
    await this.prisma.client.productVariant.update({
      where: { id: variantId },
      data: { sku: normalized },
    });
  }

  async updateVariantPrice(
    productId: number,
    variantId: number,
    dto: { price?: number; salePrice?: number },
  ): Promise<void> {
    const variant = await this.prisma.client.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    await this.prisma.client.productVariant.update({
      where: { id: variantId },
      data: {
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.salePrice !== undefined ? { salePrice: dto.salePrice } : {}),
      },
    });
  }

  // Cross-sell ("You May Also Like" in the cart drawer, and the PDP's Cross
  // Sell Products section) and Frequently Bought Together (the PDP's
  // checkbox bundle widget) — ProductRelation is a generic table
  // (RELATED/CROSS_SELL/UP_SELL/FREQUENTLY_BOUGHT_TOGETHER); RELATED and
  // UP_SELL have no consumer yet, so only these two admin surfaces exist.
  async getCrossSell(productId: number): Promise<number[]> {
    const rows = await this.prisma.client.productRelation.findMany({
      where: { fromProductId: productId, type: 'CROSS_SELL' },
      select: { toProductId: true },
    });
    return rows.map((r) => r.toProductId);
  }

  async updateCrossSell(productId: number, productIds: number[]): Promise<number[]> {
    await this.adminGet(productId);
    const targetIds = productIds.filter((id) => id !== productId);
    if (targetIds.length) {
      const count = await this.prisma.client.product.count({
        where: { id: { in: targetIds }, deletedAt: null },
      });
      if (count !== targetIds.length) throw new BadRequestException('One or more products not found');
    }

    await this.prisma.client.productRelation.deleteMany({
      where: { fromProductId: productId, type: 'CROSS_SELL' },
    });
    if (targetIds.length) {
      await this.prisma.client.productRelation.createMany({
        data: targetIds.map((toProductId) => ({ fromProductId: productId, toProductId, type: 'CROSS_SELL' })),
      });
    }
    return this.getCrossSell(productId);
  }

  async getFrequentlyBoughtTogether(productId: number): Promise<number[]> {
    const rows = await this.prisma.client.productRelation.findMany({
      where: { fromProductId: productId, type: 'FREQUENTLY_BOUGHT_TOGETHER' },
      select: { toProductId: true },
    });
    return rows.map((r) => r.toProductId);
  }

  async updateFrequentlyBoughtTogether(productId: number, productIds: number[]): Promise<number[]> {
    await this.adminGet(productId);
    const targetIds = productIds.filter((id) => id !== productId);
    if (targetIds.length) {
      const count = await this.prisma.client.product.count({
        where: { id: { in: targetIds }, deletedAt: null },
      });
      if (count !== targetIds.length) throw new BadRequestException('One or more products not found');
    }

    await this.prisma.client.productRelation.deleteMany({
      where: { fromProductId: productId, type: 'FREQUENTLY_BOUGHT_TOGETHER' },
    });
    if (targetIds.length) {
      await this.prisma.client.productRelation.createMany({
        data: targetIds.map((toProductId) => ({ fromProductId: productId, toProductId, type: 'FREQUENTLY_BOUGHT_TOGETHER' })),
      });
    }
    return this.getFrequentlyBoughtTogether(productId);
  }

  // Published-only, locale-resolved product summaries for a relation type —
  // the public PDP's Cross Sell Products / Frequently Bought Together
  // sections (unlike the two admin methods above, which return raw ids
  // regardless of publish status since the admin needs to see what it picked).
  private async getPublicRelation(
    productId: number,
    type: 'CROSS_SELL' | 'FREQUENTLY_BOUGHT_TOGETHER',
    locale: Locale,
  ): Promise<PublicProductDto[]> {
    const relations = await this.prisma.client.productRelation.findMany({
      where: {
        fromProductId: productId,
        type,
        toProduct: { deletedAt: null, status: 'PUBLISHED' },
      },
      include: { toProduct: { include: PRODUCT_INCLUDE } },
    });
    return relations.map((r) => toPublicProductDto(r.toProduct, locale));
  }

  async publicList(
    locale: Locale,
    page: number,
    pageSize: number,
    filters: ProductFilterQueryDto,
  ): Promise<PaginatedResult<PublicProductDto>> {
    const where = this.buildWhere(filters, {
      deletedAt: null,
      status: 'PUBLISHED' as const,
    });

    if (filters.sort === ProductSort.PRICE_ASC || filters.sort === ProductSort.PRICE_DESC) {
      return this.publicListSortedByEffectivePrice(locale, page, pageSize, where, filters.sort);
    }

    const [items, total] = await Promise.all([
      this.prisma.client.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: this.buildOrderBy(filters.sort),
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.product.count({ where }),
    ]);
    return toPaginatedResult(
      items.map((p) => toPublicProductDto(p, locale)),
      total,
      page,
      pageSize,
    );
  }

  // `Product.price` is null for variant products (price lives on the
  // default variant instead), so a plain DB-level `orderBy: { price }`
  // clustered every variant product at one end of the list regardless of
  // its real price instead of interleaving correctly with simple products —
  // the low-to-high/high-to-low sort looked broken because it was sorting a
  // column that isn't what the card actually displays. Resolves each
  // product's effective price the same way the storefront card and the
  // collection page's client-side sort already do (own price, else the
  // default variant's, else the first variant's), sorts in JS, then
  // paginates against that order.
  private async publicListSortedByEffectivePrice(
    locale: Locale,
    page: number,
    pageSize: number,
    where: Prisma.ProductWhereInput,
    sort: ProductSort.PRICE_ASC | ProductSort.PRICE_DESC,
  ): Promise<PaginatedResult<PublicProductDto>> {
    const all = await this.prisma.client.product.findMany({
      where,
      select: {
        id: true,
        price: true,
        variants: { select: { price: true }, orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }], take: 1 },
      },
    });

    const effectivePrice = (p: (typeof all)[number]) => Number(p.price ?? p.variants[0]?.price ?? 0);
    const sorted = all.sort((a, b) => {
      const diff = effectivePrice(a) - effectivePrice(b);
      return sort === ProductSort.PRICE_DESC ? -diff : diff;
    });

    const total = sorted.length;
    const start = (page - 1) * pageSize;
    const pageIds = sorted.slice(start, start + pageSize).map((p) => p.id);

    const items = await this.prisma.client.product.findMany({
      where: { id: { in: pageIds } },
      include: PRODUCT_INCLUDE,
    });
    const itemsById = new Map(items.map((p) => [p.id, p]));
    const ordered = pageIds.map((id) => itemsById.get(id)).filter((p): p is (typeof items)[number] => p !== undefined);

    return toPaginatedResult(ordered.map((p) => toPublicProductDto(p, locale)), total, page, pageSize);
  }

  async getManyByIds(
    ids: number[],
    locale: Locale,
  ): Promise<Map<number, PublicProductDto>> {
    if (ids.length === 0) return new Map();
    const products = await this.prisma.client.product.findMany({
      where: { id: { in: ids }, deletedAt: null, status: 'PUBLISHED' },
      include: PRODUCT_INCLUDE,
    });
    return new Map(products.map((p) => [p.id, toPublicProductDto(p, locale)]));
  }

  async generatePreviewToken(id: number): Promise<{ token: string }> {
    await this.adminGet(id);
    const token = await this.tokens.signProductPreviewToken(id);
    return { token };
  }

  async publicGetBySlug(
    slug: string,
    locale: Locale,
    previewToken?: string,
  ): Promise<PublicProductDetailDto> {
    // Same convention as blog posts' preview link: a valid token minted for
    // THIS product unlocks it regardless of status; an invalid/expired token
    // just falls back to the normal published-only lookup rather than
    // surfacing a hard auth error (an expired preview link 404s the same way
    // a wrong slug would, instead of leaking "this product exists").
    let allowUnpublished: number | null = null;
    if (previewToken) {
      try {
        const payload = await this.tokens.verifyProductPreviewToken(previewToken);
        allowUnpublished = payload.productId;
      } catch {
        allowUnpublished = null;
      }
    }

    const product = await this.prisma.client.product.findFirst({
      where: {
        slug,
        deletedAt: null,
        ...(allowUnpublished ? {} : { status: 'PUBLISHED' }),
      },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException('Product not found');
    if (allowUnpublished && product.id !== allowUnpublished) {
      throw new NotFoundException('Product not found');
    }
    // Previewing a draft shouldn't inflate real view-count analytics.
    if (!allowUnpublished) {
      await this.prisma.client.product.update({
        where: { id: product.id },
        data: { viewCount: { increment: 1 } },
      });
    }

    const dto = toPublicProductDto(product, locale);
    const imageUrls = dto.media.map((m) => m.url);
    const seo = await this.seo.resolve('PRODUCT', product.id, locale, {
      title: dto.name,
      description: dto.description,
      canonicalPath: `/products/${dto.slug}`,
      imageUrl: imageUrls[0] ?? null,
    });

    const [crossSell, frequentlyBoughtTogether] = await Promise.all([
      this.getPublicRelation(product.id, 'CROSS_SELL', locale),
      this.getPublicRelation(product.id, 'FREQUENTLY_BOUGHT_TOGETHER', locale),
    ]);

    const translation =
      product.translations.find((t) => t.locale === locale) ?? product.translations[0];
    const faqs = (translation?.faqs ?? []).map((f) => ({
      question: f.question,
      answer: f.answer,
    }));

    const aggregateRating = await this.reviews.getAggregateRating(product.id);
    // ponytail: salePrice ?? price is the display price for structured data,
    // not a full re-run of PricingService's sale-window logic — revisit if
    // a sale-window mismatch ever surfaces here.
    const structuredData = [
      buildProductJsonLd({
        name: dto.name,
        description: dto.description,
        imageUrls,
        sku: dto.sku,
        brandName: dto.brand?.name ?? null,
        price: dto.salePrice ?? dto.price,
        currency: 'BDT',
        inStock: dto.stockStatus === 'IN_STOCK',
        canonicalUrl: seo.canonicalUrl,
        aggregateRating,
      }),
      buildBreadcrumbJsonLd([
        { name: 'Home', url: this.seo.absoluteUrl('/') },
        ...(dto.categories[0]
          ? [
              {
                name: dto.categories[0].name,
                url: this.seo.absoluteUrl(
                  `/categories/${dto.categories[0].slug}`,
                ),
              },
            ]
          : []),
        { name: dto.name, url: seo.canonicalUrl },
      ]),
      ...(dto.videoUrl
        ? [
            buildVideoObjectJsonLd({
              name: dto.name,
              description: dto.description,
              thumbnailUrl: imageUrls[0] ?? null,
              videoUrl: dto.videoUrl,
              uploadDate: product.createdAt,
            }),
          ]
        : []),
    ];
    const faqJsonLd = buildFaqPageJsonLd(faqs);
    if (faqJsonLd) structuredData.push(faqJsonLd);

    return { ...dto, seo, structuredData, faqs, crossSell, frequentlyBoughtTogether };
  }

  private buildWhere(
    filters: ProductFilterQueryDto,
    base: Record<string, unknown>,
  ) {
    return {
      ...base,
      ...(filters.brandId !== undefined ? { brandId: filters.brandId } : {}),
      ...(filters.isFeatured !== undefined
        ? { isFeatured: filters.isFeatured }
        : {}),
      ...(filters.flagLabels?.length
        ? { flagLabel: { in: filters.flagLabels } }
        : {}),
      ...(filters.categoryIds?.length
        ? { categories: { some: { categoryId: { in: filters.categoryIds } } } }
        : {}),
      ...(filters.tagIds?.length
        ? { tags: { some: { tagId: { in: filters.tagIds } } } }
        : {}),
      ...(filters.minPrice !== undefined || filters.maxPrice !== undefined
        ? {
            price: {
              ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
              ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}),
            },
          }
        : {}),
      ...(filters.q?.trim()
        ? {
            OR: [
              { translations: { some: { name: { contains: filters.q.trim(), mode: 'insensitive' as const } } } },
              { sku: { contains: filters.q.trim(), mode: 'insensitive' as const } },
              { slug: { contains: filters.q.trim(), mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
  }

  private buildOrderBy(
    sort: ProductSort | undefined,
  ): Prisma.ProductOrderByWithRelationInput {
    switch (sort) {
      case ProductSort.PRICE_ASC:
        return { price: 'asc' };
      case ProductSort.PRICE_DESC:
        return { price: 'desc' };
      case ProductSort.BEST_SELLING:
        return { viewCount: 'desc' };
      case ProductSort.NEWEST:
      default:
        return { createdAt: 'desc' };
    }
  }

  private validatePricingShape(dto: CreateProductDto): void {
    if (!dto.hasVariants && dto.price === undefined) {
      throw new BadRequestException(
        'price is required when hasVariants is false',
      );
    }
    if (dto.hasVariants && (!dto.variants || dto.variants.length === 0)) {
      throw new BadRequestException(
        'At least one variant is required when hasVariants is true',
      );
    }
  }

  // Not a schema-level FK (Prisma can't express "must belong to one of these
  // attributes"), but catches the most common authoring mistake: a variant
  // using an attribute value from an axis the product never declared.
  private async validateVariantAttributeValues(
    declaredAttributeIds: number[],
    variants: CreateProductVariantDto[],
  ): Promise<void> {
    const allValueIds = [
      ...new Set(variants.flatMap((v) => v.attributeValueIds)),
    ];
    if (allValueIds.length === 0) return;

    const values = await this.prisma.client.attributeValue.findMany({
      where: { id: { in: allValueIds } },
      select: { id: true, attributeId: true },
    });
    if (values.length !== allValueIds.length) {
      throw new BadRequestException('One or more attribute values not found');
    }
    const declared = new Set(declaredAttributeIds);
    const stray = values.filter((v) => !declared.has(v.attributeId));
    if (stray.length > 0) {
      throw new BadRequestException(
        `Attribute value id(s) ${stray.map((v) => v.id).join(', ')} belong to an attribute not declared in attributeIds`,
      );
    }
  }

  private async assertSlugAvailable(
    slug: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.prisma.client.product.findUnique({
      where: { slug },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Slug "${slug}" is already in use`);
    }
  }

  private async validateReferences(
    dto: CreateProductDto | UpdateProductDto,
  ): Promise<void> {
    if (dto.brandId !== undefined) {
      const brand = await this.prisma.client.brand.findFirst({
        where: { id: dto.brandId, deletedAt: null },
      });
      if (!brand) throw new BadRequestException('Brand not found');
    }
    if (dto.categoryIds?.length) {
      const count = await this.prisma.client.category.count({
        where: { id: { in: dto.categoryIds }, deletedAt: null },
      });
      if (count !== dto.categoryIds.length)
        throw new BadRequestException('One or more categories not found');
    }
    if (dto.tagIds?.length) {
      const count = await this.prisma.client.tag.count({
        where: { id: { in: dto.tagIds }, deletedAt: null },
      });
      if (count !== dto.tagIds.length)
        throw new BadRequestException('One or more tags not found');
    }
    if (dto.attributeIds?.length) {
      const count = await this.prisma.client.attribute.count({
        where: { id: { in: dto.attributeIds } },
      });
      if (count !== dto.attributeIds.length)
        throw new BadRequestException('One or more attributes not found');
    }
    if (dto.mediaIds?.length) {
      const count = await this.prisma.client.media.count({
        where: { id: { in: dto.mediaIds } },
      });
      if (count !== dto.mediaIds.length)
        throw new BadRequestException('One or more media items not found');
    }
  }
}
