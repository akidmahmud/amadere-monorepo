import { Injectable } from '@nestjs/common';
import { PaginatedResult } from '@amader/shared';
import { SuccessResponseDto } from '../../common/dto/success-response.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginationArgs,
  toPaginatedResult,
} from '../../common/pagination.util';
import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';
import { NewsletterSubscriberDto } from './newsletter.mapper';

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

  async adminList(
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<NewsletterSubscriberDto>> {
    const [items, total] = await Promise.all([
      this.prisma.client.newsletterSubscriber.findMany({
        orderBy: { subscribedAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.newsletterSubscriber.count(),
    ]);
    return toPaginatedResult(items, total, page, pageSize);
  }
}
