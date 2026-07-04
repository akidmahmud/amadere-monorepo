import {
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
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { AdminPageDto, toAdminPageDto, toPublicPageDto } from './pages.mapper';

const WITH_TRANSLATIONS = { translations: true } as const;

@Injectable()
export class PagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seo: SeoService,
  ) {}

  async adminList(page: number, pageSize: number) {
    const where = { deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.client.page.findMany({
        where,
        include: WITH_TRANSLATIONS,
        orderBy: { id: 'asc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.page.count({ where }),
    ]);
    return toPaginatedResult(items.map(toAdminPageDto), total, page, pageSize);
  }

  async adminGet(id: number): Promise<AdminPageDto> {
    const page = await this.prisma.client.page.findFirst({
      where: { id, deletedAt: null },
      include: WITH_TRANSLATIONS,
    });
    if (!page) throw new NotFoundException('Page not found');
    return toAdminPageDto(page);
  }

  async create(dto: CreatePageDto): Promise<AdminPageDto> {
    await this.assertSlugAvailable(dto.slug);
    const page = await this.prisma.client.page.create({
      data: {
        slug: dto.slug,
        status: dto.status,
        translations: { create: dto.translations },
      },
      include: WITH_TRANSLATIONS,
    });
    return toAdminPageDto(page);
  }

  async update(id: number, dto: UpdatePageDto): Promise<AdminPageDto> {
    await this.adminGet(id);
    if (dto.slug) await this.assertSlugAvailable(dto.slug, id);

    if (dto.translations) {
      await this.prisma.client.pageTranslation.deleteMany({
        where: { pageId: id },
      });
    }

    const page = await this.prisma.client.page.update({
      where: { id },
      data: {
        slug: dto.slug,
        status: dto.status,
        translations: dto.translations
          ? { create: dto.translations }
          : undefined,
      },
      include: WITH_TRANSLATIONS,
    });
    return toAdminPageDto(page);
  }

  async delete(id: number): Promise<void> {
    await this.adminGet(id);
    await this.prisma.client.page.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async publicGetBySlug(slug: string, locale: Locale) {
    const page = await this.prisma.client.page.findFirst({
      where: { slug, deletedAt: null, status: 'PUBLISHED' },
      include: WITH_TRANSLATIONS,
    });
    if (!page) throw new NotFoundException('Page not found');
    const dto = toPublicPageDto(page, locale);
    const seo = await this.seo.resolve('PAGE', page.id, locale, {
      title: dto.title,
      canonicalPath: `/${dto.slug}`,
    });
    return { ...dto, seo };
  }

  private async assertSlugAvailable(
    slug: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.prisma.client.page.findUnique({
      where: { slug },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Slug "${slug}" is already in use`);
    }
  }
}
