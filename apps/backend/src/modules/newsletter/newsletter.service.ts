import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { SuccessResponseDto } from '../../common/dto/success-response.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginationArgs,
  toPaginatedResult,
} from '../../common/pagination.util';
import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';
import { AdminNewsletterQueryDto } from './dto/admin-newsletter-query.dto';
import { NewsletterSubscriberDto } from './newsletter.mapper';

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

@Injectable()
export class NewsletterService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(dto: SubscribeNewsletterDto): Promise<SuccessResponseDto> {
    await this.prisma.client.newsletterSubscriber.upsert({
      where: { email: dto.email },
      create: { email: dto.email, status: 'SUBSCRIBED' },
      update: { status: 'SUBSCRIBED', unsubscribedAt: null },
    });
    return { success: true };
  }

  async unsubscribe(dto: SubscribeNewsletterDto): Promise<SuccessResponseDto> {
    await this.prisma.client.newsletterSubscriber.updateMany({
      where: { email: dto.email },
      data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() },
    });
    return { success: true };
  }

  private searchWhere(q?: string): Prisma.NewsletterSubscriberWhereInput {
    return q ? { email: { contains: q, mode: 'insensitive' } } : {};
  }

  async adminList(
    query: AdminNewsletterQueryDto,
  ): Promise<PaginatedResult<NewsletterSubscriberDto>> {
    const where = this.searchWhere(query.q);
    const [items, total] = await Promise.all([
      this.prisma.client.newsletterSubscriber.findMany({
        where,
        orderBy: { subscribedAt: 'desc' },
        ...paginationArgs(query.page ?? 1, query.pageSize ?? 20),
      }),
      this.prisma.client.newsletterSubscriber.count({ where }),
    ]);
    return toPaginatedResult(items, total, query.page ?? 1, query.pageSize ?? 20);
  }

  async delete(id: number): Promise<void> {
    const existing = await this.prisma.client.newsletterSubscriber.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Subscriber not found');
    await this.prisma.client.newsletterSubscriber.delete({ where: { id } });
  }

  async bulkDelete(ids: number[]): Promise<{ deleted: number }> {
    const result = await this.prisma.client.newsletterSubscriber.deleteMany({
      where: { id: { in: ids } },
    });
    return { deleted: result.count };
  }

  async exportCsv(q?: string): Promise<string> {
    const rows = await this.prisma.client.newsletterSubscriber.findMany({
      where: this.searchWhere(q),
      orderBy: { subscribedAt: 'desc' },
    });
    const header = ['id', 'email', 'status', 'subscribedAt', 'unsubscribedAt'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [r.id.toString(), r.email, r.status, r.subscribedAt.toISOString(), r.unsubscribedAt?.toISOString() ?? '']
          .map(csvField)
          .join(','),
      );
    }
    return lines.join('\n');
  }
}
