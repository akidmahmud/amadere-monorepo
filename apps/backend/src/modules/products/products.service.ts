import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Locale } from '@amader/db';
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
import { ProductFilterQueryDto } from './dto/product-filter-query.dto';
import { SeoService } from '../seo/seo.service';
import { ReviewsService } from '../reviews/reviews.service';
import {
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
  buildVideoObjectJsonLd,
} from '../../common/structured-data/structured-data.util';

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
  ) {
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

  async adminGet(id: number) {
    const product = await this.prisma.client.product.findFirst({
      where: { id, deletedAt: null },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException('Product not found');
    return toAdminProductDto(product);
  }

  async create(dto: CreateProductDto) {
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
        translations: { create: dto.translations },
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

  async update(id: number, dto: UpdateProductDto) {
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
        translations: dto.translations
          ? { create: dto.translations }
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
  async addVariant(productId: number, dto: CreateProductVariantDto) {
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

  async publicList(
    locale: Locale,
    page: number,
    pageSize: number,
    filters: ProductFilterQueryDto,
  ) {
    const where = this.buildWhere(filters, {
      deletedAt: null,
      status: 'PUBLISHED' as const,
    });
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
      items.map((p) => toPublicProductDto(p, locale)),
      total,
      page,
      pageSize,
    );
  }

  async publicGetBySlug(slug: string, locale: Locale) {
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
      ...(filters.categoryId !== undefined
        ? { categories: { some: { categoryId: filters.categoryId } } }
        : {}),
      ...(filters.tagId !== undefined
        ? { tags: { some: { tagId: filters.tagId } } }
        : {}),
    };
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
