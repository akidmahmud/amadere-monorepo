import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReviewStatus } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginationArgs,
  toPaginatedResult,
} from '../../common/pagination.util';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewStatusDto } from './dto/update-review-status.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import {
  REVIEW_INCLUDE,
  toPublicReviewDto,
  toReviewDto,
} from './reviews.mapper';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(customerId: number, dto: CreateReviewDto) {
    const existing = await this.prisma.client.review.findUnique({
      where: { productId_customerId: { productId: dto.productId, customerId } },
    });
    if (existing)
      throw new ConflictException('You have already reviewed this product');

    // Verified-purchase only: must have a completed order containing this product.
    const orderItem = await this.prisma.client.orderItem.findFirst({
      where: {
        productId: dto.productId,
        order: { customerId, status: 'COMPLETED' },
      },
      orderBy: { id: 'asc' },
    });
    if (!orderItem) {
      throw new ForbiddenException(
        'You can only review products from a completed order',
      );
    }

    const review = await this.prisma.client.review.create({
      data: {
        productId: dto.productId,
        customerId,
        orderItemId: orderItem.id,
        orderId: orderItem.orderId,
        rating: dto.rating,
        comment: dto.comment,
        images: dto.images ?? [],
      },
      include: REVIEW_INCLUDE,
    });
    return toReviewDto(review, 'EN');
  }

  // Lightweight aggregate for embedding in Product structured data (B10) —
  // deliberately not the full publicListForProduct query, which also
  // fetches/maps a page of review rows nothing needs here.
  async getAggregateRating(
    productId: number,
  ): Promise<{ average: number; count: number } | null> {
    const where = { productId, status: 'APPROVED' as ReviewStatus };
    const [count, aggregate] = await Promise.all([
      this.prisma.client.review.count({ where }),
      this.prisma.client.review.aggregate({ where, _avg: { rating: true } }),
    ]);
    if (count === 0 || aggregate._avg.rating === null) return null;
    return { average: Number(aggregate._avg.rating.toFixed(2)), count };
  }

  async publicListForProduct(
    productId: number,
    page: number,
    pageSize: number,
  ) {
    const where = { productId, status: 'APPROVED' as ReviewStatus };
    const [items, total, aggregate] = await Promise.all([
      this.prisma.client.review.findMany({
        where,
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.review.count({ where }),
      this.prisma.client.review.aggregate({ where, _avg: { rating: true } }),
    ]);
    return {
      ...toPaginatedResult(items.map(toPublicReviewDto), total, page, pageSize),
      averageRating: aggregate._avg.rating
        ? Number(aggregate._avg.rating.toFixed(2))
        : null,
      reviewCount: total,
    };
  }

  async myReviews(customerId: number, page: number, pageSize: number) {
    const where = { customerId };
    const [items, total] = await Promise.all([
      this.prisma.client.review.findMany({
        where,
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.review.count({ where }),
    ]);
    return toPaginatedResult(
      items.map((r) => toReviewDto(r, 'EN')),
      total,
      page,
      pageSize,
    );
  }

  async adminList(page: number, pageSize: number, status?: ReviewStatus) {
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.client.review.findMany({
        where,
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.review.count({ where }),
    ]);
    return toPaginatedResult(
      items.map((r) => toReviewDto(r, 'EN')),
      total,
      page,
      pageSize,
    );
  }

  async updateStatus(id: number, dto: UpdateReviewStatusDto) {
    await this.assertExists(id);
    const review = await this.prisma.client.review.update({
      where: { id },
      data: { status: dto.status },
      include: REVIEW_INCLUDE,
    });
    return toReviewDto(review, 'EN');
  }

  async reply(id: number, dto: ReplyReviewDto, adminUserId: number) {
    await this.assertExists(id);
    await this.prisma.client.reviewReply.upsert({
      where: { reviewId: id },
      create: { reviewId: id, adminUserId, message: dto.message },
      update: { message: dto.message, adminUserId },
    });
    const review = await this.prisma.client.review.findUniqueOrThrow({
      where: { id },
      include: REVIEW_INCLUDE,
    });
    return toReviewDto(review, 'EN');
  }

  private async assertExists(id: number) {
    const review = await this.prisma.client.review.findUnique({
      where: { id },
    });
    if (!review) throw new NotFoundException('Review not found');
  }
}
