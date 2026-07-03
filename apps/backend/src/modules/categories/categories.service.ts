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
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import {
  AdminCategoryDto,
  toAdminCategoryDto,
  toPublicCategoryDto,
} from './categories.mapper';

const WITH_TRANSLATIONS = { translations: true } as const;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async adminList(page: number, pageSize: number, parentId?: number) {
    const where = {
      deletedAt: null,
      ...(parentId !== undefined ? { parentId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.category.findMany({
        where,
        include: WITH_TRANSLATIONS,
        orderBy: { sortOrder: 'asc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.category.count({ where }),
    ]);
    return toPaginatedResult(
      items.map(toAdminCategoryDto),
      total,
      page,
      pageSize,
    );
  }

  async adminGet(id: number): Promise<AdminCategoryDto> {
    const category = await this.prisma.client.category.findFirst({
      where: { id, deletedAt: null },
      include: WITH_TRANSLATIONS,
    });
    if (!category) throw new NotFoundException('Category not found');
    return toAdminCategoryDto(category);
  }

  async create(dto: CreateCategoryDto): Promise<AdminCategoryDto> {
    await this.assertSlugAvailable(dto.slug);
    if (dto.parentId !== undefined) await this.assertParentExists(dto.parentId);

    const category = await this.prisma.client.category.create({
      data: {
        slug: dto.slug,
        parentId: dto.parentId,
        imageUrl: dto.imageUrl,
        iconUrl: dto.iconUrl,
        isFeatured: dto.isFeatured,
        sortOrder: dto.sortOrder,
        status: dto.status,
        translations: { create: dto.translations },
      },
      include: WITH_TRANSLATIONS,
    });
    return toAdminCategoryDto(category);
  }

  async update(id: number, dto: UpdateCategoryDto): Promise<AdminCategoryDto> {
    await this.adminGet(id);
    if (dto.slug) await this.assertSlugAvailable(dto.slug, id);
    if (dto.parentId !== undefined)
      await this.assertValidParent(id, dto.parentId);

    if (dto.translations) {
      await this.prisma.client.categoryTranslation.deleteMany({
        where: { categoryId: id },
      });
    }

    const category = await this.prisma.client.category.update({
      where: { id },
      data: {
        slug: dto.slug,
        parentId: dto.parentId,
        imageUrl: dto.imageUrl,
        iconUrl: dto.iconUrl,
        isFeatured: dto.isFeatured,
        sortOrder: dto.sortOrder,
        status: dto.status,
        translations: dto.translations
          ? { create: dto.translations }
          : undefined,
      },
      include: WITH_TRANSLATIONS,
    });
    return toAdminCategoryDto(category);
  }

  async delete(id: number): Promise<void> {
    await this.adminGet(id);
    const childCount = await this.prisma.client.category.count({
      where: { parentId: id, deletedAt: null },
    });
    if (childCount > 0) {
      throw new ConflictException('Reassign or delete child categories first');
    }
    await this.prisma.client.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async publicList(
    locale: Locale,
    page: number,
    pageSize: number,
    parentId?: number,
  ) {
    const where = {
      deletedAt: null,
      status: 'PUBLISHED' as const,
      ...(parentId !== undefined ? { parentId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.category.findMany({
        where,
        include: WITH_TRANSLATIONS,
        orderBy: { sortOrder: 'asc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.category.count({ where }),
    ]);
    return toPaginatedResult(
      items.map((c) => toPublicCategoryDto(c, locale)),
      total,
      page,
      pageSize,
    );
  }

  async publicGetBySlug(slug: string, locale: Locale) {
    const category = await this.prisma.client.category.findFirst({
      where: { slug, deletedAt: null, status: 'PUBLISHED' },
      include: WITH_TRANSLATIONS,
    });
    if (!category) throw new NotFoundException('Category not found');
    return toPublicCategoryDto(category, locale);
  }

  private async assertSlugAvailable(
    slug: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.prisma.client.category.findUnique({
      where: { slug },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Slug "${slug}" is already in use`);
    }
  }

  private async assertParentExists(parentId: number): Promise<void> {
    const parent = await this.prisma.client.category.findFirst({
      where: { id: parentId, deletedAt: null },
    });
    if (!parent) throw new BadRequestException('Parent category not found');
  }

  // Guards against self-parenting and deeper cycles (a real bug class in the
  // old app's category tree — see B1 review notes).
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
        await this.prisma.client.category.findUnique({
          where: { id: current },
          select: { parentId: true },
        });
      current = row?.parentId ?? null;
    }
  }
}
