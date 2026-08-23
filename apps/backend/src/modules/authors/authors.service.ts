import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginationArgs,
  toPaginatedResult,
} from '../../common/pagination.util';
import { CreateAuthorDto } from './dto/create-author.dto';
import { UpdateAuthorDto } from './dto/update-author.dto';
import { AdminAuthorDto, toAdminAuthorDto } from './authors.mapper';

const WITH_TRANSLATIONS = { translations: true } as const;

@Injectable()
export class AuthorsService {
  constructor(private readonly prisma: PrismaService) {}

  async adminList(
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<AdminAuthorDto>> {
    const where = { deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.client.author.findMany({
        where,
        include: { ...WITH_TRANSLATIONS, _count: { select: { products: true } } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.author.count({ where }),
    ]);
    return toPaginatedResult(
      items.map((a) => toAdminAuthorDto(a, a._count.products)),
      total,
      page,
      pageSize,
    );
  }

  async adminGet(id: number): Promise<AdminAuthorDto> {
    const author = await this.prisma.client.author.findFirst({
      where: { id, deletedAt: null },
      include: { ...WITH_TRANSLATIONS, _count: { select: { products: true } } },
    });
    if (!author) throw new NotFoundException('Author not found');
    return toAdminAuthorDto(author, author._count.products);
  }

  async create(dto: CreateAuthorDto): Promise<AdminAuthorDto> {
    await this.assertSlugAvailable(dto.slug);
    const author = await this.prisma.client.author.create({
      data: {
        slug: dto.slug,
        photoUrl: dto.photoUrl,
        socialLinks: this.toSocialLinksJson(dto.socialLinks),
        sortOrder: dto.sortOrder,
        status: dto.status,
        translations: { create: dto.translations },
      },
      include: { ...WITH_TRANSLATIONS, _count: { select: { products: true } } },
    });
    return toAdminAuthorDto(author, author._count.products);
  }

  async update(id: number, dto: UpdateAuthorDto): Promise<AdminAuthorDto> {
    await this.adminGet(id);
    if (dto.slug) await this.assertSlugAvailable(dto.slug, id);

    // Same replace-in-place strategy BrandsService.update uses: translations
    // arrive as a whole array, so the old rows go and the new ones are
    // written, rather than diffing per locale.
    if (dto.translations) {
      await this.prisma.client.authorTranslation.deleteMany({
        where: { authorId: id },
      });
    }

    const author = await this.prisma.client.author.update({
      where: { id },
      data: {
        slug: dto.slug,
        photoUrl: dto.photoUrl,
        socialLinks:
          dto.socialLinks === undefined
            ? undefined
            : this.toSocialLinksJson(dto.socialLinks),
        sortOrder: dto.sortOrder,
        status: dto.status,
        translations: dto.translations
          ? { create: dto.translations }
          : undefined,
      },
      include: { ...WITH_TRANSLATIONS, _count: { select: { products: true } } },
    });
    return toAdminAuthorDto(author, author._count.products);
  }

  async delete(id: number): Promise<void> {
    await this.adminGet(id);
    // Soft delete, like every other catalog entity. Products keep pointing at
    // the row, so nothing 500s mid-render; the public product query filters
    // deletedAt itself, which is what actually hides the Author tab.
    await this.prisma.client.author.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private toSocialLinksJson(
    links: CreateAuthorDto['socialLinks'],
  ): Prisma.InputJsonValue {
    return (links ?? []).map((l) => ({
      icon: l.icon,
      url: l.url,
      ...(l.label ? { label: l.label } : {}),
    }));
  }

  private async assertSlugAvailable(
    slug: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.prisma.client.author.findUnique({
      where: { slug },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Slug "${slug}" is already in use`);
    }
  }
}
