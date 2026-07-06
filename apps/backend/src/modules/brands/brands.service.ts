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
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import {
  AdminBrandDto,
  PublicBrandDetailDto,
  PublicBrandDto,
  toAdminBrandDto,
  toPublicBrandDto,
} from './brands.mapper';

const WITH_TRANSLATIONS = { translations: true } as const;

@Injectable()
export class BrandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seo: SeoService,
  ) {}

  async adminList(page: number, pageSize: number) {
    const [items, total] = await Promise.all([
      this.prisma.client.brand.findMany({
        where: { deletedAt: null },
        include: WITH_TRANSLATIONS,
        orderBy: { sortOrder: 'asc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.brand.count({ where: { deletedAt: null } }),
    ]);
    return toPaginatedResult(items.map(toAdminBrandDto), total, page, pageSize);
  }

  async adminGet(id: number): Promise<AdminBrandDto> {
    const brand = await this.prisma.client.brand.findFirst({
      where: { id, deletedAt: null },
      include: WITH_TRANSLATIONS,
    });
    if (!brand) throw new NotFoundException('Brand not found');
    return toAdminBrandDto(brand);
  }

  async create(dto: CreateBrandDto): Promise<AdminBrandDto> {
    await this.assertSlugAvailable(dto.slug);
    const brand = await this.prisma.client.brand.create({
      data: {
        slug: dto.slug,
        logoUrl: dto.logoUrl,
        websiteUrl: dto.websiteUrl,
        isFeatured: dto.isFeatured,
        sortOrder: dto.sortOrder,
        status: dto.status,
        translations: { create: dto.translations },
      },
      include: WITH_TRANSLATIONS,
    });
    return toAdminBrandDto(brand);
  }

  async update(id: number, dto: UpdateBrandDto): Promise<AdminBrandDto> {
    await this.adminGet(id);
    if (dto.slug) await this.assertSlugAvailable(dto.slug, id);

    if (dto.translations) {
      await this.prisma.client.brandTranslation.deleteMany({
        where: { brandId: id },
      });
    }

    const brand = await this.prisma.client.brand.update({
      where: { id },
      data: {
        slug: dto.slug,
        logoUrl: dto.logoUrl,
        websiteUrl: dto.websiteUrl,
        isFeatured: dto.isFeatured,
        sortOrder: dto.sortOrder,
        status: dto.status,
        translations: dto.translations
          ? { create: dto.translations }
          : undefined,
      },
      include: WITH_TRANSLATIONS,
    });
    return toAdminBrandDto(brand);
  }

  async delete(id: number): Promise<void> {
    await this.adminGet(id);
    await this.prisma.client.brand.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async publicList(
    locale: Locale,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<PublicBrandDto>> {
    const where = { deletedAt: null, status: 'PUBLISHED' } as const;
    const [items, total] = await Promise.all([
      this.prisma.client.brand.findMany({
        where,
        include: WITH_TRANSLATIONS,
        orderBy: { sortOrder: 'asc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.brand.count({ where }),
    ]);
    return toPaginatedResult(
      items.map((b) => toPublicBrandDto(b, locale)),
      total,
      page,
      pageSize,
    );
  }

  async publicGetBySlug(
    slug: string,
    locale: Locale,
  ): Promise<PublicBrandDetailDto> {
    const brand = await this.prisma.client.brand.findFirst({
      where: { slug, deletedAt: null, status: 'PUBLISHED' },
      include: WITH_TRANSLATIONS,
    });
    if (!brand) throw new NotFoundException('Brand not found');
    const dto = toPublicBrandDto(brand, locale);
    const seo = await this.seo.resolve('BRAND', brand.id, locale, {
      title: dto.name,
      description: dto.description,
      canonicalPath: `/brands/${dto.slug}`,
      imageUrl: dto.logoUrl,
    });
    return { ...dto, seo };
  }

  private async assertSlugAvailable(
    slug: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.prisma.client.brand.findUnique({
      where: { slug },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Slug "${slug}" is already in use`);
    }
  }
}
