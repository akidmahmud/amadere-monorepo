import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { HomepageSectionType, Locale, Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CollectionsService } from '../collections/collections.service';
import { ProductsService } from '../products/products.service';
import { PublicProductDto } from '../products/dto/product-response.dto';
import { CreateHomepageSectionDto } from './dto/create-homepage-section.dto';
import { UpdateHomepageSectionDto } from './dto/update-homepage-section.dto';
import {
  AdminHomepageSectionDto,
  PublicHomepageSectionDto,
  toAdminHomepageSectionDto,
  toPublicHomepageSectionDto,
} from './homepage-sections.mapper';

const WITH_TRANSLATIONS = { translations: true } as const;

@Injectable()
export class HomepageSectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collections: CollectionsService,
    private readonly products: ProductsService,
  ) {}

  async adminList(): Promise<AdminHomepageSectionDto[]> {
    const sections = await this.prisma.client.homepageSection.findMany({
      include: WITH_TRANSLATIONS,
      orderBy: { sortOrder: 'asc' },
    });
    return sections.map(toAdminHomepageSectionDto);
  }

  async adminGet(id: number): Promise<AdminHomepageSectionDto> {
    const section = await this.prisma.client.homepageSection.findUnique({
      where: { id },
      include: WITH_TRANSLATIONS,
    });
    if (!section) throw new NotFoundException('Homepage section not found');
    return toAdminHomepageSectionDto(section);
  }

  async create(dto: CreateHomepageSectionDto): Promise<AdminHomepageSectionDto> {
    await this.assertValidCollectionRef(dto.type, dto.collectionId);
    await this.assertValidTabCollectionRefs(dto.type, dto.config);

    const section = await this.prisma.client.homepageSection.create({
      data: {
        type: dto.type,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
        collectionId: dto.collectionId,
        translations: dto.translations ? { create: dto.translations } : undefined,
      },
      include: WITH_TRANSLATIONS,
    });
    return toAdminHomepageSectionDto(section);
  }

  async update(
    id: number,
    dto: UpdateHomepageSectionDto,
  ): Promise<AdminHomepageSectionDto> {
    const existing = await this.adminGet(id);
    await this.assertValidCollectionRef(
      dto.type ?? existing.type,
      dto.collectionId !== undefined ? dto.collectionId : (existing.collectionId ?? undefined),
    );
    await this.assertValidTabCollectionRefs(
      dto.type ?? existing.type,
      dto.config !== undefined ? dto.config : existing.config,
    );

    if (dto.translations) {
      await this.prisma.client.homepageSectionTranslation.deleteMany({
        where: { sectionId: id },
      });
    }

    const section = await this.prisma.client.homepageSection.update({
      where: { id },
      data: {
        type: dto.type,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        config: dto.config as Prisma.InputJsonValue | undefined,
        collectionId: dto.collectionId,
        translations: dto.translations ? { create: dto.translations } : undefined,
      },
      include: WITH_TRANSLATIONS,
    });
    return toAdminHomepageSectionDto(section);
  }

  async delete(id: number): Promise<void> {
    await this.adminGet(id);
    await this.prisma.client.homepageSection.delete({ where: { id } });
  }

  async reorder(ids: number[]): Promise<void> {
    await this.prisma.client.$transaction(
      ids.map((id, index) =>
        this.prisma.client.homepageSection.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
  }

  async publicList(locale: Locale): Promise<PublicHomepageSectionDto[]> {
    const sections = await this.prisma.client.homepageSection.findMany({
      where: { isActive: true },
      include: WITH_TRANSLATIONS,
      orderBy: { sortOrder: 'asc' },
    });

    return Promise.all(
      sections.map(async (section) => {
        const collection =
          section.type === 'PRODUCT_COLLECTION' && section.collectionId
            ? await this.collections.getResolvedById(section.collectionId, locale)
            : null;
        const tabCollections =
          section.type === 'TABBED_COLLECTION_CAROUSEL'
            ? await this.resolveTabCollections(section.config, locale)
            : null;
        const promoVideoProducts =
          section.type === 'PROMO_VIDEO'
            ? await this.resolvePromoVideoProducts(section.config, locale)
            : null;
        return toPublicHomepageSectionDto(
          section,
          collection,
          locale,
          tabCollections,
          promoVideoProducts,
        );
      }),
    );
  }

  private async resolvePromoVideoProducts(
    config: unknown,
    locale: Locale,
  ): Promise<(PublicProductDto | null)[]> {
    const productIds = extractPromoVideoProductIds(config);
    const uniqueIds = [...new Set(productIds.filter((id): id is number => id !== null))];
    const resolved = await this.products.getManyByIds(uniqueIds, locale);
    return productIds.map((id) => (id !== null ? (resolved.get(id) ?? null) : null));
  }

  private async resolveTabCollections(
    config: unknown,
    locale: Locale,
  ) {
    const tabs = extractTabs(config);
    const productsPerTab = extractProductsPerTab(config);
    return Promise.all(
      tabs.map(async (tab) => {
        const collection = await this.collections.getResolvedById(tab.collectionId, locale);
        if (!collection) return null;
        return { ...collection, products: collection.products.slice(0, productsPerTab) };
      }),
    );
  }

  private async assertValidCollectionRef(
    type: HomepageSectionType,
    collectionId: number | undefined,
  ): Promise<void> {
    if (type !== 'PRODUCT_COLLECTION') return;
    if (!collectionId) {
      throw new BadRequestException(
        'collectionId is required when type = PRODUCT_COLLECTION',
      );
    }
    const collection = await this.prisma.client.collection.findFirst({
      where: { id: collectionId, deletedAt: null },
    });
    if (!collection) throw new BadRequestException('Collection not found');
  }

  private async assertValidTabCollectionRefs(
    type: HomepageSectionType,
    config: unknown,
  ): Promise<void> {
    if (type !== 'TABBED_COLLECTION_CAROUSEL') return;
    const tabs = extractTabs(config);
    if (tabs.length === 0) return;
    const ids = tabs.map((t) => t.collectionId);
    const count = await this.prisma.client.collection.count({
      where: { id: { in: ids }, deletedAt: null },
    });
    if (count !== new Set(ids).size) {
      throw new BadRequestException('One or more tab collectionId values do not exist');
    }
  }
}

function extractTabs(config: unknown): { collectionId: number }[] {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return [];
  const tabs = (config as Record<string, unknown>).tabs;
  if (!Array.isArray(tabs)) return [];
  return tabs
    .map((t) => (t && typeof t === 'object' ? (t as Record<string, unknown>).collectionId : undefined))
    .filter((id): id is number => typeof id === 'number')
    .map((collectionId) => ({ collectionId }));
}

function extractProductsPerTab(config: unknown): number {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return 10;
  const value = (config as Record<string, unknown>).productsPerTab;
  return typeof value === 'number' && value > 0 ? value : 10;
}

function extractPromoVideoProductIds(config: unknown): (number | null)[] {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return [];
  const videos = (config as Record<string, unknown>).videos;
  if (!Array.isArray(videos)) return [];
  return videos.map((v) => {
    const id = v && typeof v === 'object' ? (v as Record<string, unknown>).productId : undefined;
    return typeof id === 'number' ? id : null;
  });
}
