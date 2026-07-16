import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Locale } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginationArgs,
  toPaginatedResult,
} from '../../common/pagination.util';
import { SeoService } from '../seo/seo.service';
import { PRODUCT_INCLUDE } from '../products/product-includes';
import { toPublicProductDto } from '../products/products.mapper';
import { PublicProductDto } from '../products/dto/product-response.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import {
  AdminCollectionDto,
  PublicCollectionDetailDto,
  PublicCollectionDto,
  PublicCollectionSummaryDto,
  PublicNavCollectionDto,
  toAdminCollectionDto,
  toPublicCollectionDto,
  toPublicNavCollectionDto,
} from './collections.mapper';

const WITH_TRANSLATIONS_AND_PRODUCTS = {
  translations: true,
  products: { orderBy: { sortOrder: 'asc' as const } },
} as const;

@Injectable()
export class CollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seo: SeoService,
  ) {}

  async adminList(
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<AdminCollectionDto>> {
    const where = { deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.client.collection.findMany({
        where,
        include: WITH_TRANSLATIONS_AND_PRODUCTS,
        orderBy: { sortOrder: 'asc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.collection.count({ where }),
    ]);
    return toPaginatedResult(
      items.map(toAdminCollectionDto),
      total,
      page,
      pageSize,
    );
  }

  async adminGet(id: number): Promise<AdminCollectionDto> {
    const collection = await this.prisma.client.collection.findFirst({
      where: { id, deletedAt: null },
      include: WITH_TRANSLATIONS_AND_PRODUCTS,
    });
    if (!collection) throw new NotFoundException('Collection not found');
    return toAdminCollectionDto(collection);
  }

  async create(dto: CreateCollectionDto): Promise<AdminCollectionDto> {
    await this.assertSlugAvailable(dto.slug);

    const collection = await this.prisma.client.collection.create({
      data: {
        slug: dto.slug,
        status: dto.status,
        sortOrder: dto.sortOrder,
        showInNav: dto.showInNav,
        translations: { create: dto.translations },
        products: dto.products
          ? {
              create: dto.products.map((p) => ({
                productId: p.productId,
                sortOrder: p.sortOrder,
              })),
            }
          : undefined,
      },
      include: WITH_TRANSLATIONS_AND_PRODUCTS,
    });
    return toAdminCollectionDto(collection);
  }

  async update(
    id: number,
    dto: UpdateCollectionDto,
  ): Promise<AdminCollectionDto> {
    await this.adminGet(id);
    if (dto.slug) await this.assertSlugAvailable(dto.slug, id);

    if (dto.translations) {
      await this.prisma.client.collectionTranslation.deleteMany({
        where: { collectionId: id },
      });
    }
    if (dto.products) {
      await this.prisma.client.collectionProduct.deleteMany({
        where: { collectionId: id },
      });
    }

    const collection = await this.prisma.client.collection.update({
      where: { id },
      data: {
        slug: dto.slug,
        status: dto.status,
        sortOrder: dto.sortOrder,
        showInNav: dto.showInNav,
        translations: dto.translations
          ? { create: dto.translations }
          : undefined,
        products: dto.products
          ? {
              create: dto.products.map((p) => ({
                productId: p.productId,
                sortOrder: p.sortOrder,
              })),
            }
          : undefined,
      },
      include: WITH_TRANSLATIONS_AND_PRODUCTS,
    });
    return toAdminCollectionDto(collection);
  }

  async delete(id: number): Promise<void> {
    await this.adminGet(id);
    await this.prisma.client.collection.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async publicNavList(locale: Locale): Promise<PublicNavCollectionDto[]> {
    const items = await this.prisma.client.collection.findMany({
      where: { deletedAt: null, status: 'PUBLISHED', showInNav: true },
      include: { translations: true, products: { orderBy: { sortOrder: 'asc' as const } } },
      orderBy: { sortOrder: 'asc' },
    });
    return items.map((c) => toPublicNavCollectionDto(c, locale));
  }

  async publicList(
    locale: Locale,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<PublicCollectionSummaryDto>> {
    const where = { deletedAt: null, status: 'PUBLISHED' as const };
    const [items, total] = await Promise.all([
      this.prisma.client.collection.findMany({
        where,
        include: WITH_TRANSLATIONS_AND_PRODUCTS,
        orderBy: { sortOrder: 'asc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.collection.count({ where }),
    ]);
    return toPaginatedResult(
      items.map((c) => toPublicCollectionDto(c, [], locale)),
      total,
      page,
      pageSize,
    );
  }

  async publicGetBySlug(
    slug: string,
    locale: Locale,
  ): Promise<PublicCollectionDetailDto> {
    const collection = await this.prisma.client.collection.findFirst({
      where: { slug, deletedAt: null, status: 'PUBLISHED' },
      include: WITH_TRANSLATIONS_AND_PRODUCTS,
    });
    if (!collection) throw new NotFoundException('Collection not found');
    const products = await this.loadPublicProducts(collection.id, locale);
    const dto = toPublicCollectionDto(collection, products, locale);
    const seo = await this.seo.resolve('COLLECTION', collection.id, locale, {
      title: dto.name,
      description: dto.description,
      canonicalPath: `/collections/${dto.slug}`,
    });
    return { ...dto, seo };
  }

  // Used internally by HomepageSectionsService to resolve a
  // PRODUCT_COLLECTION section's referenced collection — not exposed
  // directly over HTTP (no SEO needed for an embedded homepage section).
  async getResolvedById(
    id: number,
    locale: Locale,
  ): Promise<PublicCollectionDto | null> {
    const collection = await this.prisma.client.collection.findFirst({
      where: { id, deletedAt: null, status: 'PUBLISHED' },
      include: WITH_TRANSLATIONS_AND_PRODUCTS,
    });
    if (!collection) return null;
    const products = await this.loadPublicProducts(collection.id, locale);
    return toPublicCollectionDto(collection, products, locale);
  }

  private async loadPublicProducts(
    collectionId: number,
    locale: Locale,
  ): Promise<PublicProductDto[]> {
    const collectionProducts = await this.prisma.client.collectionProduct.findMany({
      where: { collectionId },
      orderBy: { sortOrder: 'asc' },
      include: { product: { include: PRODUCT_INCLUDE } },
    });
    return collectionProducts
      .filter((cp) => cp.product.status === 'PUBLISHED' && !cp.product.deletedAt)
      .map((cp) => toPublicProductDto(cp.product, locale));
  }

  private async assertSlugAvailable(
    slug: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.prisma.client.collection.findUnique({
      where: { slug },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Slug "${slug}" is already in use`);
    }
  }
}
