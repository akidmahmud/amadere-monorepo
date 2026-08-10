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
        // TABBED_COLLECTION_CAROUSEL is now a single-collection product
        // strip (no tabs — see the section's own component doc), so it
        // resolves via the same collectionId FK as PRODUCT_COLLECTION.
        const collection =
          (section.type === 'PRODUCT_COLLECTION' || section.type === 'TABBED_COLLECTION_CAROUSEL') &&
          section.collectionId
            ? await this.collections.getResolvedById(section.collectionId, locale)
            : null;
        const topSellingProducts =
          section.type === 'TOP_SELLING_PRODUCTS'
            ? await this.resolveConfigItemProducts(section.config, locale)
            : null;
        const justForYouProducts =
          section.type === 'JUST_FOR_YOU'
            ? await this.resolveConfigItemProducts(section.config, locale)
            : null;
        const featuredDealsProducts =
          section.type === 'FEATURED_DEALS'
            ? await this.resolveConfigItemProducts(section.config, locale)
            : null;
        return toPublicHomepageSectionDto(
          section,
          collection,
          locale,
          topSellingProducts,
          justForYouProducts,
          featuredDealsProducts,
        );
      }),
    );
  }

  // Shared by TOP_SELLING_PRODUCTS, JUST_FOR_YOU, and FEATURED_DEALS — all
  // three store an admin-picked `config.items: {productId, showBadge}[]`
  // and need the same "resolve ids, preserve order/length" treatment.
  private async resolveConfigItemProducts(
    config: unknown,
    locale: Locale,
  ): Promise<(PublicProductDto | null)[]> {
    const productIds = extractConfigItemProductIds(config);
    const uniqueIds = [...new Set(productIds.filter((id): id is number => id !== null))];
    const resolved = await this.products.getManyByIds(uniqueIds, locale);
    return productIds.map((id) => (id !== null ? (resolved.get(id) ?? null) : null));
  }

  // Required for both PRODUCT_COLLECTION and TABBED_COLLECTION_CAROUSEL —
  // the latter used to store per-tab collectionIds inside config.tabs, but
  // is now a single-collection product strip (no tabs) using this same FK,
  // same as PRODUCT_COLLECTION.
  private async assertValidCollectionRef(
    type: HomepageSectionType,
    collectionId: number | undefined,
  ): Promise<void> {
    if (type !== 'PRODUCT_COLLECTION' && type !== 'TABBED_COLLECTION_CAROUSEL') return;
    if (!collectionId) {
      throw new BadRequestException(`collectionId is required when type = ${type}`);
    }
    const collection = await this.prisma.client.collection.findFirst({
      where: { id: collectionId, deletedAt: null },
    });
    if (!collection) throw new BadRequestException('Collection not found');
  }
}

function extractConfigItemProductIds(config: unknown): (number | null)[] {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return [];
  const items = (config as Record<string, unknown>).items;
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const id = item && typeof item === 'object' ? (item as Record<string, unknown>).productId : undefined;
    return typeof id === 'number' ? id : null;
  });
}
