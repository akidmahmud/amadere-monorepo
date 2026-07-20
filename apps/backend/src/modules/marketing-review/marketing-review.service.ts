import { Injectable, NotFoundException } from '@nestjs/common';
import { Locale } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateMarketingReviewCardDto } from './dto/create-marketing-review-card.dto';
import { UpdateMarketingReviewCardDto } from './dto/update-marketing-review-card.dto';
import {
  AdminMarketingReviewCardDto,
  PublicMarketingReviewCardDto,
  toAdminMarketingReviewCardDto,
  toPublicMarketingReviewCardDto,
} from './marketing-review.mapper';

const WITH_TRANSLATIONS = { translations: true } as const;

@Injectable()
export class MarketingReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async adminList(): Promise<AdminMarketingReviewCardDto[]> {
    const items = await this.prisma.client.marketingReviewCard.findMany({
      include: WITH_TRANSLATIONS,
      orderBy: { sortOrder: 'asc' },
    });
    return items.map(toAdminMarketingReviewCardDto);
  }

  async adminGet(id: number): Promise<AdminMarketingReviewCardDto> {
    const item = await this.prisma.client.marketingReviewCard.findUnique({
      where: { id },
      include: WITH_TRANSLATIONS,
    });
    if (!item) throw new NotFoundException('Marketing review card not found');
    return toAdminMarketingReviewCardDto(item);
  }

  async create(dto: CreateMarketingReviewCardDto): Promise<AdminMarketingReviewCardDto> {
    const item = await this.prisma.client.marketingReviewCard.create({
      data: {
        imageUrl: dto.imageUrl,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        translations: { create: dto.translations },
      },
      include: WITH_TRANSLATIONS,
    });
    return toAdminMarketingReviewCardDto(item);
  }

  async update(
    id: number,
    dto: UpdateMarketingReviewCardDto,
  ): Promise<AdminMarketingReviewCardDto> {
    await this.adminGet(id);

    if (dto.translations) {
      await this.prisma.client.marketingReviewCardTranslation.deleteMany({
        where: { cardId: id },
      });
    }

    const item = await this.prisma.client.marketingReviewCard.update({
      where: { id },
      data: {
        imageUrl: dto.imageUrl,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        translations: dto.translations ? { create: dto.translations } : undefined,
      },
      include: WITH_TRANSLATIONS,
    });
    return toAdminMarketingReviewCardDto(item);
  }

  async delete(id: number): Promise<void> {
    await this.adminGet(id);
    await this.prisma.client.marketingReviewCard.delete({ where: { id } });
  }

  async publicList(locale: Locale): Promise<PublicMarketingReviewCardDto[]> {
    const items = await this.prisma.client.marketingReviewCard.findMany({
      where: { isActive: true },
      include: WITH_TRANSLATIONS,
      orderBy: { sortOrder: 'asc' },
    });
    return items.map((item) => toPublicMarketingReviewCardDto(item, locale));
  }
}
