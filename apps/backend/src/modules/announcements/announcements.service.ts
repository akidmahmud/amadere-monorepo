import { Injectable, NotFoundException } from '@nestjs/common';
import { Locale } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import {
  AdminAnnouncementDto,
  PublicAnnouncementDto,
  toAdminAnnouncementDto,
  toPublicAnnouncementDto,
} from './announcements.mapper';

const WITH_TRANSLATIONS = { translations: true } as const;

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async adminList(): Promise<AdminAnnouncementDto[]> {
    const items = await this.prisma.client.announcement.findMany({
      include: WITH_TRANSLATIONS,
      orderBy: { sortOrder: 'asc' },
    });
    return items.map(toAdminAnnouncementDto);
  }

  async adminGet(id: number): Promise<AdminAnnouncementDto> {
    const item = await this.prisma.client.announcement.findUnique({
      where: { id },
      include: WITH_TRANSLATIONS,
    });
    if (!item) throw new NotFoundException('Announcement not found');
    return toAdminAnnouncementDto(item);
  }

  async create(dto: CreateAnnouncementDto): Promise<AdminAnnouncementDto> {
    const item = await this.prisma.client.announcement.create({
      data: {
        linkUrl: dto.linkUrl,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        translations: { create: dto.translations },
      },
      include: WITH_TRANSLATIONS,
    });
    return toAdminAnnouncementDto(item);
  }

  async update(id: number, dto: UpdateAnnouncementDto): Promise<AdminAnnouncementDto> {
    await this.adminGet(id);

    if (dto.translations) {
      await this.prisma.client.announcementTranslation.deleteMany({
        where: { announcementId: id },
      });
    }

    const item = await this.prisma.client.announcement.update({
      where: { id },
      data: {
        linkUrl: dto.linkUrl,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        translations: dto.translations ? { create: dto.translations } : undefined,
      },
      include: WITH_TRANSLATIONS,
    });
    return toAdminAnnouncementDto(item);
  }

  async delete(id: number): Promise<void> {
    await this.adminGet(id);
    await this.prisma.client.announcement.delete({ where: { id } });
  }

  async publicList(locale: Locale): Promise<PublicAnnouncementDto[]> {
    const items = await this.prisma.client.announcement.findMany({
      where: { isActive: true },
      include: WITH_TRANSLATIONS,
      orderBy: { sortOrder: 'asc' },
    });
    return items.map((item) => toPublicAnnouncementDto(item, locale));
  }
}
