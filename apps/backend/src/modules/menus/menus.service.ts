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

  async adminList(q?: string): Promise<AdminMenuItemDto[]> {
    const trimmed = q?.trim();
    const where = trimmed
      ? {
          OR: [
            { href: { contains: trimmed, mode: 'insensitive' as const } },
            { translations: { some: { label: { contains: trimmed, mode: 'insensitive' as const } } } },
          ],
        }
      : {};
    const items = await this.prisma.client.menuItem.findMany({
      where,
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

  // One-time bootstrap for the drag-and-drop tree editor: before this
  // existed, the storefront navbar was auto-derived from the category tree
  // (CategoriesService.publicNavList) rather than from MenuItem rows, so a
  // brand-new install (or this app's own production DB today) has an empty
  // menu_items table. Recreates that same nav as real, editable MenuItem
  // rows — same categories, same order, same EN/BN labels — so switching the
  // storefront over to MenuItem-backed nav doesn't blank out the navbar.
  // Guarded to only run once (see the empty-table check) since re-running it
  // after an admin has customized the tree would duplicate everything.
  async importFromCategories(): Promise<AdminMenuItemDto[]> {
    const existing = await this.prisma.client.menuItem.count();
    if (existing > 0) {
      throw new BadRequestException('Menu already has items — import only runs on an empty menu');
    }

    const categories = await this.prisma.client.category.findMany({
      where: { deletedAt: null, status: 'PUBLISHED', parentId: null },
      include: {
        translations: true,
        children: {
          where: { deletedAt: null, status: 'PUBLISHED' },
          include: { translations: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    for (const [index, category] of categories.entries()) {
      const parent = await this.prisma.client.menuItem.create({
        data: {
          href: `/categories/${category.slug}`,
          sortOrder: index,
          translations: {
            create: category.translations.map((t) => ({ locale: t.locale, label: t.name })),
          },
        },
      });
      for (const [childIndex, child] of category.children.entries()) {
        await this.prisma.client.menuItem.create({
          data: {
            parentId: parent.id,
            href: `/categories/${child.slug}`,
            sortOrder: childIndex,
            translations: {
              create: child.translations.map((t) => ({ locale: t.locale, label: t.name })),
            },
          },
        });
      }
    }

    return this.adminList();
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
    // The tree is exactly 2 levels deep (top item + dropdown children, same
    // as toPublicMenuItemDto's shape) — a parent that itself has a parent
    // would make a 3rd level nothing renders. Enforced here, not just left
    // as an admin-UI convention, since this is the one place both the tree
    // editor's drag-and-drop and the plain create/update form funnel through.
    if (parent.parentId !== null) {
      throw new BadRequestException('Menu items can only be nested one level deep');
    }
  }

  // Same self-reference cycle guard as CategoriesService.
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
