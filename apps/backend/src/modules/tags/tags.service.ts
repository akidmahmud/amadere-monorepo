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
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import {
  AdminTagDto,
  PublicTagDetailDto,
  toAdminTagDto,
  toPublicTagDto,
} from './tags.mapper';

const WITH_TRANSLATIONS = { translations: true } as const;

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seo: SeoService,
  ) {}

  async adminList(page: number, pageSize: number, q?: string, ids?: string) {
    // Batch-resolve a known set of ids — callers that already know exactly
    // which tags they need (e.g. a product's assigned tags that fall past
    // the picker's first-100-page cutoff) skip pagination/q entirely rather
    // than being truncated to whatever page size they'd otherwise ask for.
    // Replaces what used to be one GET /admin/tags/:id per missing id.
    if (ids?.trim()) {
      const parsedIds = ids
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n));
      const items = await this.prisma.client.tag.findMany({
        where: { deletedAt: null, id: { in: parsedIds } },
        include: WITH_TRANSLATIONS,
      });
      const mapped = items.map(toAdminTagDto);
      return toPaginatedResult(mapped, mapped.length, 1, mapped.length || 1);
    }

    const where = {
      deletedAt: null,
      // Lets callers check "does a tag named X already exist" against the
      // full catalog instead of only whatever page-1-of-100 a plain list
      // fetch returns — the product editor's tag autocomplete needs this to
      // avoid creating duplicate tags once the catalog passes 100 rows.
      ...(q?.trim()
        ? { translations: { some: { name: { contains: q.trim(), mode: 'insensitive' as const } } } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.tag.findMany({
        where,
        include: WITH_TRANSLATIONS,
        orderBy: { id: 'asc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.tag.count({ where }),
    ]);
    return toPaginatedResult(items.map(toAdminTagDto), total, page, pageSize);
  }

  async adminGet(id: number): Promise<AdminTagDto> {
    const tag = await this.prisma.client.tag.findFirst({
      where: { id, deletedAt: null },
      include: WITH_TRANSLATIONS,
    });
    if (!tag) throw new NotFoundException('Tag not found');
    return toAdminTagDto(tag);
  }

  async create(dto: CreateTagDto): Promise<AdminTagDto> {
    await this.assertSlugAvailable(dto.slug);
    const tag = await this.prisma.client.tag.create({
      data: {
        slug: dto.slug,
        status: dto.status,
        translations: { create: dto.translations },
      },
      include: WITH_TRANSLATIONS,
    });
    return toAdminTagDto(tag);
  }

  async update(id: number, dto: UpdateTagDto): Promise<AdminTagDto> {
    await this.adminGet(id);
    if (dto.slug) await this.assertSlugAvailable(dto.slug, id);

    if (dto.translations) {
      await this.prisma.client.tagTranslation.deleteMany({
        where: { tagId: id },
      });
    }

    const tag = await this.prisma.client.tag.update({
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
    return toAdminTagDto(tag);
  }

  async delete(id: number): Promise<void> {
    await this.adminGet(id);
    await this.prisma.client.tag.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async publicList(locale: Locale, page: number, pageSize: number) {
    const where = { deletedAt: null, status: 'PUBLISHED' } as const;
    const [items, total] = await Promise.all([
      this.prisma.client.tag.findMany({
        where,
        include: WITH_TRANSLATIONS,
        orderBy: { id: 'asc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.tag.count({ where }),
    ]);
    return toPaginatedResult(
      items.map((t) => toPublicTagDto(t, locale)),
      total,
      page,
      pageSize,
    );
  }

  async publicGetBySlug(
    slug: string,
    locale: Locale,
  ): Promise<PublicTagDetailDto> {
    const tag = await this.prisma.client.tag.findFirst({
      where: { slug, deletedAt: null, status: 'PUBLISHED' },
      include: WITH_TRANSLATIONS,
    });
    if (!tag) throw new NotFoundException('Tag not found');
    const dto = toPublicTagDto(tag, locale);
    const seo = await this.seo.resolve('TAG', tag.id, locale, {
      title: dto.name,
      description: dto.description,
      canonicalPath: `/tags/${dto.slug}`,
    });
    return { ...dto, seo };
  }

  private async assertSlugAvailable(
    slug: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.prisma.client.tag.findUnique({
      where: { slug },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Slug "${slug}" is already in use`);
    }
  }
}
