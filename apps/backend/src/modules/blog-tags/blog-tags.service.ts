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
import { CreateBlogTagDto } from './dto/create-blog-tag.dto';
import { UpdateBlogTagDto } from './dto/update-blog-tag.dto';
import {
  AdminBlogTagDto,
  toAdminBlogTagDto,
  toPublicBlogTagDto,
} from './blog-tags.mapper';

const WITH_TRANSLATIONS = { translations: true } as const;

@Injectable()
export class BlogTagsService {
  constructor(private readonly prisma: PrismaService) {}

  async adminList(page: number, pageSize: number) {
    const [items, total] = await Promise.all([
      this.prisma.client.blogTag.findMany({
        include: WITH_TRANSLATIONS,
        orderBy: { id: 'asc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.blogTag.count(),
    ]);
    return toPaginatedResult(
      items.map(toAdminBlogTagDto),
      total,
      page,
      pageSize,
    );
  }

  async adminGet(id: number): Promise<AdminBlogTagDto> {
    const tag = await this.prisma.client.blogTag.findUnique({
      where: { id },
      include: WITH_TRANSLATIONS,
    });
    if (!tag) throw new NotFoundException('Blog tag not found');
    return toAdminBlogTagDto(tag);
  }

  async create(dto: CreateBlogTagDto): Promise<AdminBlogTagDto> {
    await this.assertSlugAvailable(dto.slug);
    const tag = await this.prisma.client.blogTag.create({
      data: {
        slug: dto.slug,
        status: dto.status,
        translations: { create: dto.translations },
      },
      include: WITH_TRANSLATIONS,
    });
    return toAdminBlogTagDto(tag);
  }

  async update(id: number, dto: UpdateBlogTagDto): Promise<AdminBlogTagDto> {
    await this.adminGet(id);
    if (dto.slug) await this.assertSlugAvailable(dto.slug, id);

    if (dto.translations) {
      await this.prisma.client.blogTagTranslation.deleteMany({
        where: { tagId: id },
      });
    }

    const tag = await this.prisma.client.blogTag.update({
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
    return toAdminBlogTagDto(tag);
  }

  async delete(id: number): Promise<void> {
    await this.adminGet(id);
    const postCount = await this.prisma.client.blogPostTag.count({
      where: { tagId: id },
    });
    if (postCount > 0) {
      throw new ConflictException('Reassign posts off this tag first');
    }
    await this.prisma.client.blogTag.delete({ where: { id } });
  }

  async publicList(locale: Locale, page: number, pageSize: number) {
    const where = { status: 'PUBLISHED' } as const;
    const [items, total] = await Promise.all([
      this.prisma.client.blogTag.findMany({
        where,
        include: WITH_TRANSLATIONS,
        orderBy: { id: 'asc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.blogTag.count({ where }),
    ]);
    return toPaginatedResult(
      items.map((t) => toPublicBlogTagDto(t, locale)),
      total,
      page,
      pageSize,
    );
  }

  async publicGetBySlug(slug: string, locale: Locale) {
    const tag = await this.prisma.client.blogTag.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: WITH_TRANSLATIONS,
    });
    if (!tag) throw new NotFoundException('Blog tag not found');
    return toPublicBlogTagDto(tag, locale);
  }

  private async assertSlugAvailable(
    slug: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.prisma.client.blogTag.findUnique({
      where: { slug },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Slug "${slug}" is already in use`);
    }
  }
}
