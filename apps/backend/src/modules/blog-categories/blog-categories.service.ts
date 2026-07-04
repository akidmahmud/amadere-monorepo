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
import { CreateBlogCategoryDto } from './dto/create-blog-category.dto';
import { UpdateBlogCategoryDto } from './dto/update-blog-category.dto';
import {
  AdminBlogCategoryDto,
  toAdminBlogCategoryDto,
  toPublicBlogCategoryDto,
} from './blog-categories.mapper';

const WITH_TRANSLATIONS = { translations: true } as const;

@Injectable()
export class BlogCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seo: SeoService,
  ) {}

  async adminList(page: number, pageSize: number, parentId?: number) {
    const where = parentId !== undefined ? { parentId } : {};
    const [items, total] = await Promise.all([
      this.prisma.client.blogCategory.findMany({
        where,
        include: WITH_TRANSLATIONS,
        orderBy: { sortOrder: 'asc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.blogCategory.count({ where }),
    ]);
    return toPaginatedResult(
      items.map(toAdminBlogCategoryDto),
      total,
      page,
      pageSize,
    );
  }

  async adminGet(id: number): Promise<AdminBlogCategoryDto> {
    const category = await this.prisma.client.blogCategory.findUnique({
      where: { id },
      include: WITH_TRANSLATIONS,
    });
    if (!category) throw new NotFoundException('Blog category not found');
    return toAdminBlogCategoryDto(category);
  }

  async create(dto: CreateBlogCategoryDto): Promise<AdminBlogCategoryDto> {
    await this.assertSlugAvailable(dto.slug);
    if (dto.parentId !== undefined) await this.assertParentExists(dto.parentId);

    const category = await this.prisma.client.blogCategory.create({
      data: {
        slug: dto.slug,
        parentId: dto.parentId,
        sortOrder: dto.sortOrder,
        status: dto.status,
        translations: { create: dto.translations },
      },
      include: WITH_TRANSLATIONS,
    });
    return toAdminBlogCategoryDto(category);
  }

  async update(
    id: number,
    dto: UpdateBlogCategoryDto,
  ): Promise<AdminBlogCategoryDto> {
    await this.adminGet(id);
    if (dto.slug) await this.assertSlugAvailable(dto.slug, id);
    if (dto.parentId !== undefined)
      await this.assertValidParent(id, dto.parentId);

    if (dto.translations) {
      await this.prisma.client.blogCategoryTranslation.deleteMany({
        where: { categoryId: id },
      });
    }

    const category = await this.prisma.client.blogCategory.update({
      where: { id },
      data: {
        slug: dto.slug,
        parentId: dto.parentId,
        sortOrder: dto.sortOrder,
        status: dto.status,
        translations: dto.translations
          ? { create: dto.translations }
          : undefined,
      },
      include: WITH_TRANSLATIONS,
    });
    return toAdminBlogCategoryDto(category);
  }

  async delete(id: number): Promise<void> {
    await this.adminGet(id);
    const [childCount, postCount] = await Promise.all([
      this.prisma.client.blogCategory.count({ where: { parentId: id } }),
      this.prisma.client.blogPostCategory.count({ where: { categoryId: id } }),
    ]);
    if (childCount > 0) {
      throw new ConflictException('Reassign or delete child categories first');
    }
    if (postCount > 0) {
      throw new ConflictException('Reassign posts off this category first');
    }
    await this.prisma.client.blogCategory.delete({ where: { id } });
  }

  async publicList(
    locale: Locale,
    page: number,
    pageSize: number,
    parentId?: number,
  ) {
    const where = {
      status: 'PUBLISHED' as const,
      ...(parentId !== undefined ? { parentId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.blogCategory.findMany({
        where,
        include: WITH_TRANSLATIONS,
        orderBy: { sortOrder: 'asc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.blogCategory.count({ where }),
    ]);
    return toPaginatedResult(
      items.map((c) => toPublicBlogCategoryDto(c, locale)),
      total,
      page,
      pageSize,
    );
  }

  async publicGetBySlug(slug: string, locale: Locale) {
    const category = await this.prisma.client.blogCategory.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: WITH_TRANSLATIONS,
    });
    if (!category) throw new NotFoundException('Blog category not found');
    const dto = toPublicBlogCategoryDto(category, locale);
    const seo = await this.seo.resolve('BLOG_CATEGORY', category.id, locale, {
      title: dto.name,
      description: dto.description,
      canonicalPath: `/blog/category/${dto.slug}`,
    });
    return { ...dto, seo };
  }

  private async assertSlugAvailable(
    slug: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.prisma.client.blogCategory.findUnique({
      where: { slug },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Slug "${slug}" is already in use`);
    }
  }

  private async assertParentExists(parentId: number): Promise<void> {
    const parent = await this.prisma.client.blogCategory.findUnique({
      where: { id: parentId },
    });
    if (!parent) throw new BadRequestException('Parent category not found');
  }

  private async assertValidParent(
    id: number,
    parentId: number | null,
  ): Promise<void> {
    if (parentId === null) return;
    if (parentId === id)
      throw new BadRequestException('A category cannot be its own parent');
    await this.assertParentExists(parentId);

    let current: number | null = parentId;
    const seen = new Set<number>();
    while (current !== null) {
      if (current === id)
        throw new BadRequestException('This would create a category cycle');
      if (seen.has(current)) break;
      seen.add(current);
      const row: { parentId: number | null } | null =
        await this.prisma.client.blogCategory.findUnique({
          where: { id: current },
          select: { parentId: true },
        });
      current = row?.parentId ?? null;
    }
  }
}
