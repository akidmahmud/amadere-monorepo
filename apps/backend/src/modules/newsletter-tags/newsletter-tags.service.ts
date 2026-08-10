import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateNewsletterTagDto } from './dto/create-tag.dto';
import { AdminNewsletterTagDto, toAdminNewsletterTagDto } from './newsletter-tags.mapper';

@Injectable()
export class NewsletterTagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AdminNewsletterTagDto[]> {
    const tags = await this.prisma.client.newsletterTag.findMany({ orderBy: { name: 'asc' } });
    return tags.map(toAdminNewsletterTagDto);
  }

  async create(dto: CreateNewsletterTagDto): Promise<AdminNewsletterTagDto> {
    const existing = await this.prisma.client.newsletterTag.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Tag "${dto.name}" already exists`);
    const tag = await this.prisma.client.newsletterTag.create({ data: { name: dto.name } });
    return toAdminNewsletterTagDto(tag);
  }

  // Hard delete (no soft-delete column, same call as Attribute/PromoVideo)
  // — cascades off subscriber assignments and any segment referencing it
  // gets segmentId set to null via schema.prisma's onDelete rules.
  async delete(id: number): Promise<void> {
    const tag = await this.prisma.client.newsletterTag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException('Tag not found');
    await this.prisma.client.newsletterTag.delete({ where: { id } });
  }

  async addToSubscriber(subscriberId: number, tagId: number): Promise<void> {
    const [subscriber, tag] = await Promise.all([
      this.prisma.client.newsletterSubscriber.findUnique({ where: { id: subscriberId } }),
      this.prisma.client.newsletterTag.findUnique({ where: { id: tagId } }),
    ]);
    if (!subscriber) throw new NotFoundException('Subscriber not found');
    if (!tag) throw new NotFoundException('Tag not found');
    await this.prisma.client.newsletterSubscriberTag.upsert({
      where: { subscriberId_tagId: { subscriberId, tagId } },
      create: { subscriberId, tagId },
      update: {},
    });
  }

  async removeFromSubscriber(subscriberId: number, tagId: number): Promise<void> {
    await this.prisma.client.newsletterSubscriberTag.deleteMany({ where: { subscriberId, tagId } });
  }
}
