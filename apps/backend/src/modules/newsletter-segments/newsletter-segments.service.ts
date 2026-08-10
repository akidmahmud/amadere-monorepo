import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateSegmentDto } from './dto/create-segment.dto';
import { UpdateSegmentDto } from './dto/update-segment.dto';
import { AdminNewsletterSegmentDto, toAdminNewsletterSegmentDto } from './newsletter-segments.mapper';

@Injectable()
export class NewsletterSegmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AdminNewsletterSegmentDto[]> {
    const segments = await this.prisma.client.newsletterSegment.findMany({ orderBy: { createdAt: 'desc' } });
    return segments.map(toAdminNewsletterSegmentDto);
  }

  async get(id: number): Promise<AdminNewsletterSegmentDto> {
    return toAdminNewsletterSegmentDto(await this.getOrThrow(id));
  }

  async create(dto: CreateSegmentDto): Promise<AdminNewsletterSegmentDto> {
    this.validateShape(dto.type, dto.tagId, dto.days);
    const segment = await this.prisma.client.newsletterSegment.create({
      data: { name: dto.name, type: dto.type, tagId: dto.tagId, days: dto.days },
    });
    return toAdminNewsletterSegmentDto(segment);
  }

  async update(id: number, dto: UpdateSegmentDto): Promise<AdminNewsletterSegmentDto> {
    const existing = await this.getOrThrow(id);
    const type = dto.type ?? existing.type;
    const tagId = dto.tagId ?? existing.tagId ?? undefined;
    const days = dto.days ?? existing.days ?? undefined;
    this.validateShape(type, tagId, days);
    const segment = await this.prisma.client.newsletterSegment.update({
      where: { id },
      data: { name: dto.name, type: dto.type, tagId: dto.tagId, days: dto.days },
    });
    return toAdminNewsletterSegmentDto(segment);
  }

  async delete(id: number): Promise<void> {
    await this.getOrThrow(id);
    // Campaigns referencing this segment fall back to "all subscribed" via
    // onDelete: SetNull (schema.prisma) — a deleted segment doesn't orphan
    // or block deletion of campaigns already built against it.
    await this.prisma.client.newsletterSegment.delete({ where: { id } });
  }

  async count(id: number): Promise<{ count: number }> {
    await this.getOrThrow(id);
    const subscribers = await this.resolveAudience(id);
    return { count: subscribers.length };
  }

  // Shared by NewsletterCampaignsService (resolving who to actually send
  // to) and the /count endpoint above (previewing that same audience size
  // in the admin UI before a campaign is even sent) — one implementation,
  // not two copies of the same segment-type switch.
  async resolveAudience(segmentId: number | null): Promise<{ id: number; email: string }[]> {
    if (segmentId === null) {
      return this.prisma.client.newsletterSubscriber.findMany({ where: { status: 'SUBSCRIBED' }, select: { id: true, email: true } });
    }
    const segment = await this.prisma.client.newsletterSegment.findUnique({ where: { id: segmentId } });
    if (!segment) throw new BadRequestException('Segment not found');
    switch (segment.type) {
      case 'ALL':
        return this.prisma.client.newsletterSubscriber.findMany({ where: { status: 'SUBSCRIBED' }, select: { id: true, email: true } });
      case 'TAG':
        if (!segment.tagId) return [];
        return this.prisma.client.newsletterSubscriber.findMany({
          where: { status: 'SUBSCRIBED', tags: { some: { tagId: segment.tagId } } },
          select: { id: true, email: true },
        });
      case 'NEW_SUBSCRIBERS': {
        const since = new Date(Date.now() - (segment.days ?? 30) * 24 * 60 * 60 * 1000);
        return this.prisma.client.newsletterSubscriber.findMany({
          where: { status: 'SUBSCRIBED', subscribedAt: { gte: since } },
          select: { id: true, email: true },
        });
      }
    }
  }

  private validateShape(type: string, tagId: number | undefined, days: number | undefined): void {
    if (type === 'TAG' && !tagId) throw new BadRequestException('tagId is required for a TAG segment');
    if (type === 'NEW_SUBSCRIBERS' && !days) throw new BadRequestException('days is required for a NEW_SUBSCRIBERS segment');
  }

  private async getOrThrow(id: number) {
    const segment = await this.prisma.client.newsletterSegment.findUnique({ where: { id } });
    if (!segment) throw new NotFoundException('Segment not found');
    return segment;
  }
}
