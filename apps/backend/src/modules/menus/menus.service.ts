import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Locale } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import {
  AdminMenuItemDto,
  PublicMenuItemDto,
  toAdminMenuItemDto,
  toPublicMenuItemDto,
} from './menus.mapper';

const WITH_TRANSLATIONS = { translations: true } as const;

@Injectable()
export class MenusService {
  constructor(private readonly prisma: PrismaService) {}

  async adminList(): Promise<AdminMenuItemDto[]> {
    const items = await this.prisma.client.menuItem.findMany({
      include: WITH_TRANSLATIONS,
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }],
    });
    return items.map(toAdminMenuItemDto);
  }

  async adminGet(id: number): Promise<AdminMenuItemDto> {
    const item = await this.prisma.client.menuItem.findUnique({
      where: { id },
      include: WITH_TRANSLATIONS,
    });
    if (!item) throw new NotFoundException('Menu item not found');
    return toAdminMenuItemDto(item);
  }

  async create(dto: CreateMenuItemDto): Promise<AdminMenuItemDto> {
    if (dto.parentId !== undefined) await this.assertParentExists(dto.parentId);

    const item = await this.prisma.client.menuItem.create({
      data: {
        parentId: dto.parentId,
        href: dto.href,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        translations: { create: dto.translations },
      },
      include: WITH_TRANSLATIONS,
    });
    return toAdminMenuItemDto(item);
  }

  async update(id: number, dto: UpdateMenuItemDto): Promise<AdminMenuItemDto> {
    await this.adminGet(id);
    if (dto.parentId !== undefined) await this.assertValidParent(id, dto.parentId);

    if (dto.translations) {
      await this.prisma.client.menuItemTranslation.deleteMany({
        where: { menuItemId: id },
      });
    }

    const item = await this.prisma.client.menuItem.update({
      where: { id },
      data: {
        parentId: dto.parentId,
        href: dto.href,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        translations: dto.translations
          ? { create: dto.translations }
          : undefined,
      },
      include: WITH_TRANSLATIONS,
    });
    return toAdminMenuItemDto(item);
  }

  async delete(id: number): Promise<void> {
    await this.adminGet(id);
    await this.prisma.client.menuItem.delete({ where: { id } });
  }

  async publicTree(locale: Locale): Promise<PublicMenuItemDto[]> {
    const topLevel = await this.prisma.client.menuItem.findMany({
      where: { parentId: null, isActive: true },
      include: {
        translations: true,
        children: { include: { translations: true }, orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { sortOrder: 'asc' },
    });
    return topLevel.map((item) => toPublicMenuItemDto(item, locale));
  }

  private async assertParentExists(parentId: number): Promise<void> {
    const parent = await this.prisma.client.menuItem.findUnique({
      where: { id: parentId },
    });
    if (!parent) throw new BadRequestException('Parent menu item not found');
  }

  // Same self-reference cycle guard as CategoriesService — a menu tree is
  // only ever 2 levels deep in practice, but nothing stops an admin from
  // trying to nest deeper, so the guard still matters.
  private async assertValidParent(
    id: number,
    parentId: number | null,
  ): Promise<void> {
    if (parentId === null) return;
    if (parentId === id) {
      throw new BadRequestException('A menu item cannot be its own parent');
    }
    await this.assertParentExists(parentId);

    let current: number | null = parentId;
    const seen = new Set<number>();
    while (current !== null) {
      if (current === id) {
        throw new BadRequestException('This would create a menu item cycle');
      }
      if (seen.has(current)) break;
      seen.add(current);
      const row: { parentId: number | null } | null =
        await this.prisma.client.menuItem.findUnique({
          where: { id: current },
          select: { parentId: true },
        });
      current = row?.parentId ?? null;
    }
  }
}
