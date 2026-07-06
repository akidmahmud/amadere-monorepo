import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { HomepageSectionType, Locale, Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CollectionsService } from '../collections/collections.service';
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
        const collection =
          section.type === 'PRODUCT_COLLECTION' && section.collectionId
            ? await this.collections.getResolvedById(section.collectionId, locale)
            : null;
        return toPublicHomepageSectionDto(section, collection, locale);
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
}
