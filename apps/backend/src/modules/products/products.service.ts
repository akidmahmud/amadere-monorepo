import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Locale, Prisma } from '@amader/db';
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
import {
  AdminProductDto,
  PublicProductDetailDto,
  PublicProductDto,
} from './dto/product-response.dto';
import { SeoService } from '../seo/seo.service';
import { ReviewsService } from '../reviews/reviews.service';
import {
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
  buildVideoObjectJsonLd,
} from '../../common/structured-data/structured-data.util';

// class-transformer produces real ProductInfoVisualContentDto/
// ProductComparisonContentDto instances (via @Type on the corresponding
// ProductTranslationDto fields), but Prisma's Json input type wants a plain
// object with a string index signature — this round-trips through
// plain-object spread so the shape matches structurally without changing
// any actual values.
function toTranslationCreateInput(translations: ProductTranslationDto[]) {
  return translations.map((t) => ({
    ...t,
    infoVisualContent: t.infoVisualContent
      ? ({ ...t.infoVisualContent } as Prisma.InputJsonValue)
      : undefined,
    comparisonContent: t.comparisonContent
      ? ({ ...t.comparisonContent } as Prisma.InputJsonValue)
      : undefined,
  }));
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seo: SeoService,
    private readonly reviews: ReviewsService,
  ) {}

  async adminList(
    page: number,
    pageSize: number,
    filters: ProductFilterQueryDto,
  ): Promise<PaginatedResult<AdminProductDto>> {
    const where = this.buildWhere(filters, { deletedAt: null });
    const [items, total] = await Promise.all([
      this.prisma.client.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.product.count({ where }),
    ]);
    return toPaginatedResult(
      items.map(toAdminProductDto),
      total,
      page,
      pageSize,
    );
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
        videoUrl: dto.videoUrl,
        hasVariants: dto.hasVariants,
        trackInventory: dto.trackInventory,
        allowBackorder: dto.allowBackorder,
        stock: dto.hasVariants ? 0 : dto.stock,
        stockStatus: dto.stockStatus,
        price: dto.hasVariants ? undefined : dto.price,
        salePrice: dto.salePrice,
        saleStartsAt: dto.saleStartsAt,
        saleEndsAt: dto.saleEndsAt,
        costPerItem: dto.costPerItem,
        shippableWeight: dto.shippableWeight,
        minOrderQuantity: dto.minOrderQuantity,
        maxOrderQuantity: dto.maxOrderQuantity,
        infoVisualImages: dto.infoVisualImages as unknown as Prisma.InputJsonValue,
        comparisonImages: dto.comparisonImages as unknown as Prisma.InputJsonValue,
        translations: { create: toTranslationCreateInput(dto.translations) },
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
        videoUrl: dto.videoUrl,
        trackInventory: dto.trackInventory,
        allowBackorder: dto.allowBackorder,
        stock: dto.stock,
        stockStatus: dto.stockStatus,
        price: dto.price,
        salePrice: dto.salePrice,
        saleStartsAt: dto.saleStartsAt,
        saleEndsAt: dto.saleEndsAt,
        costPerItem: dto.costPerItem,
        shippableWeight: dto.shippableWeight,
        minOrderQuantity: dto.minOrderQuantity,
        maxOrderQuantity: dto.maxOrderQuantity,
        infoVisualImages: dto.infoVisualImages
          ? (dto.infoVisualImages as unknown as Prisma.InputJsonValue)
          : undefined,
        comparisonImages: dto.comparisonImages
          ? (dto.comparisonImages as unknown as Prisma.InputJsonValue)
          : undefined,
        translations: dto.translations
          ? { create: toTranslationCreateInput(dto.translations) }
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
  }

  // ADDENDUM §B1 — the Inventory view needs to edit variant stock inline;
  // simple (non-variant) products already go through the general update().
  async updateVariantStock(
    productId: number,
    variantId: number,
    stock: number,
  ): Promise<void> {
    const variant = await this.prisma.client.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    await this.prisma.client.productVariant.update({
      where: { id: variantId },
      data: { stock },
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

  // Cross-sell ("You May Also Like" in the cart drawer) — ProductRelation is
  // a generic table (RELATED/CROSS_SELL/UP_SELL/FREQUENTLY_BOUGHT_TOGETHER)
  // but only CROSS_SELL has a real consumer today (cart.service.ts), so this
  // admin surface is scoped to that one type rather than exposing all four.
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

  async publicGetBySlug(
    slug: string,
    locale: Locale,
  ): Promise<PublicProductDetailDto> {
    const product = await this.prisma.client.product.findFirst({
      where: { slug, deletedAt: null, status: 'PUBLISHED' },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException('Product not found');
    await this.prisma.client.product.update({
      where: { id: product.id },
      data: { viewCount: { increment: 1 } },
    });

    const dto = toPublicProductDto(product, locale);
    const imageUrls = dto.media.map((m) => m.url);
    const seo = await this.seo.resolve('PRODUCT', product.id, locale, {
      title: dto.name,
      description: dto.description,
      canonicalPath: `/products/${dto.slug}`,
      imageUrl: imageUrls[0] ?? null,
    });

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

    return { ...dto, seo, structuredData };
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
