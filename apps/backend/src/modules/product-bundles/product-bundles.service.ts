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
import { SeoService } from '../seo/seo.service';
import {
  BUNDLE_INCLUDE,
  toAdminBundleDto,
  toPublicBundleDto,
} from './product-bundles.mapper';
import { CreateProductBundleDto } from './dto/create-product-bundle.dto';
import { UpdateProductBundleDto } from './dto/update-product-bundle.dto';

@Injectable()
export class ProductBundlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seo: SeoService,
  ) {}

  async adminList(page: number, pageSize: number) {
    const [items, total] = await Promise.all([
      this.prisma.client.productBundle.findMany({
        include: BUNDLE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.productBundle.count(),
    ]);
    return toPaginatedResult(
      items.map(toAdminBundleDto),
      total,
      page,
      pageSize,
    );
  }

  async adminGet(id: number) {
    const bundle = await this.prisma.client.productBundle.findUnique({
      where: { id },
      include: BUNDLE_INCLUDE,
    });
    if (!bundle) throw new NotFoundException('Bundle not found');
    return toAdminBundleDto(bundle);
  }

  async create(dto: CreateProductBundleDto) {
    await this.assertSlugAvailable(dto.slug);
    await this.assertProductsExist(dto.items.map((i) => i.productId));

    const bundle = await this.prisma.client.productBundle.create({
      data: {
        slug: dto.slug,
        bundlePrice: dto.bundlePrice,
        discountPct: dto.discountPct,
        status: dto.status,
        translations: { create: dto.translations },
        items: {
          create: dto.items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
          })),
        },
      },
      include: BUNDLE_INCLUDE,
    });
    return toAdminBundleDto(bundle);
  }

  async update(id: number, dto: UpdateProductBundleDto) {
    await this.adminGet(id);
    if (dto.slug) await this.assertSlugAvailable(dto.slug, id);
    if (dto.items)
      await this.assertProductsExist(dto.items.map((i) => i.productId));

    if (dto.translations) {
      await this.prisma.client.productBundleTranslation.deleteMany({
        where: { bundleId: id },
      });
    }
    if (dto.items) {
      await this.prisma.client.productBundleItem.deleteMany({
        where: { bundleId: id },
      });
    }

    const bundle = await this.prisma.client.productBundle.update({
      where: { id },
      data: {
        slug: dto.slug,
        bundlePrice: dto.bundlePrice,
        discountPct: dto.discountPct,
        status: dto.status,
        translations: dto.translations
          ? { create: dto.translations }
          : undefined,
        items: dto.items
          ? {
              create: dto.items.map((i) => ({
                productId: i.productId,
                variantId: i.variantId,
                quantity: i.quantity,
              })),
            }
          : undefined,
      },
      include: BUNDLE_INCLUDE,
    });
    return toAdminBundleDto(bundle);
  }

  async delete(id: number): Promise<void> {
    await this.adminGet(id);
    await this.prisma.client.productBundle.delete({ where: { id } });
  }

  async publicList(locale: Locale, page: number, pageSize: number) {
    const where = { status: 'PUBLISHED' as const };
    const [items, total] = await Promise.all([
      this.prisma.client.productBundle.findMany({
        where,
        include: BUNDLE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.productBundle.count({ where }),
    ]);
    return toPaginatedResult(
      items.map((b) => toPublicBundleDto(b, locale)),
      total,
      page,
      pageSize,
    );
  }

  async publicGetBySlug(slug: string, locale: Locale) {
    const bundle = await this.prisma.client.productBundle.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: BUNDLE_INCLUDE,
    });
    if (!bundle) throw new NotFoundException('Bundle not found');
    const dto = toPublicBundleDto(bundle, locale);
    const seo = await this.seo.resolve('PRODUCT_BUNDLE', bundle.id, locale, {
      title: dto.name,
      description: dto.description,
      canonicalPath: `/product-bundles/${dto.slug}`,
    });
    return { ...dto, seo };
  }

  private async assertSlugAvailable(
    slug: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.prisma.client.productBundle.findUnique({
      where: { slug },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Slug "${slug}" is already in use`);
    }
  }

  private async assertProductsExist(productIds: number[]): Promise<void> {
    const count = await this.prisma.client.product.count({
      where: { id: { in: productIds }, deletedAt: null },
    });
    if (count !== new Set(productIds).size)
      throw new BadRequestException('One or more products not found');
  }
}
