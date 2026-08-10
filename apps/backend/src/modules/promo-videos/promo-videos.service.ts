import { Injectable, NotFoundException } from '@nestjs/common';
import { Locale } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SeoService } from '../seo/seo.service';
import { PRODUCT_INCLUDE } from '../products/product-includes';
import { toPublicProductDto } from '../products/products.mapper';
import { PublicProductDto } from '../products/dto/product-response.dto';
import { buildVideoObjectJsonLd } from '../../common/structured-data/structured-data.util';
import { CreatePromoVideoDto } from './dto/create-promo-video.dto';
import { UpdatePromoVideoDto } from './dto/update-promo-video.dto';
import {
  AdminPromoVideoDto,
  PublicPromoVideoDto,
  toAdminPromoVideoDto,
  toPublicPromoVideoDto,
} from './promo-videos.mapper';

@Injectable()
export class PromoVideosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seo: SeoService,
  ) {}

  async adminList(): Promise<AdminPromoVideoDto[]> {
    const videos = await this.prisma.client.promoVideo.findMany({ orderBy: { sortOrder: 'asc' } });
    return videos.map(toAdminPromoVideoDto);
  }

  async adminGet(id: number): Promise<AdminPromoVideoDto> {
    const video = await this.prisma.client.promoVideo.findUnique({ where: { id } });
    if (!video) throw new NotFoundException('Promo video not found');
    return toAdminPromoVideoDto(video);
  }

  async create(dto: CreatePromoVideoDto): Promise<AdminPromoVideoDto> {
    const last = await this.prisma.client.promoVideo.findFirst({ orderBy: { sortOrder: 'desc' } });
    const video = await this.prisma.client.promoVideo.create({
      data: {
        title: dto.title,
        source: dto.source,
        url: dto.url,
        durationSeconds: dto.durationSeconds,
        thumbnailUrl: dto.thumbnailUrl,
        productId: dto.productId,
        showInHomepage: dto.showInHomepage ?? true,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
    return toAdminPromoVideoDto(video);
  }

  async update(id: number, dto: UpdatePromoVideoDto): Promise<AdminPromoVideoDto> {
    await this.adminGet(id);
    const video = await this.prisma.client.promoVideo.update({
      where: { id },
      data: {
        title: dto.title,
        source: dto.source,
        url: dto.url,
        durationSeconds: dto.durationSeconds,
        thumbnailUrl: dto.thumbnailUrl,
        productId: dto.productId,
        showInHomepage: dto.showInHomepage,
      },
    });
    return toAdminPromoVideoDto(video);
  }

  // No soft delete (same call as Attribute — nothing downstream needs
  // history on a deleted promo video, unlike Product/Category/etc.).
  async delete(id: number): Promise<void> {
    await this.adminGet(id);
    await this.prisma.client.promoVideo.delete({ where: { id } });
  }

  async reorder(ids: number[]): Promise<void> {
    await this.prisma.client.$transaction(
      ids.map((id, index) => this.prisma.client.promoVideo.update({ where: { id }, data: { sortOrder: index } })),
    );
  }

  // Fixed homepage position now (not a reorderable HomepageSection type) —
  // the storefront renders this whole list in one spot, so no pagination.
  async publicList(locale: Locale): Promise<PublicPromoVideoDto[]> {
    const videos = await this.prisma.client.promoVideo.findMany({
      where: { showInHomepage: true },
      orderBy: { sortOrder: 'asc' },
    });
    const productIds = [...new Set(videos.map((v) => v.productId).filter((id): id is number => id !== null))];
    const products = productIds.length
      ? await this.prisma.client.product.findMany({
          where: { id: { in: productIds }, status: 'PUBLISHED', deletedAt: null },
          include: PRODUCT_INCLUDE,
        })
      : [];
    const productById = new Map(products.map((p) => [p.id, toPublicProductDto(p, locale)]));

    return Promise.all(
      videos.map(async (video) => {
        const product: PublicProductDto | null = video.productId ? (productById.get(video.productId) ?? null) : null;
        // No dedicated video detail page — these render inline on the
        // homepage, so that's the honest canonical page for both the
        // resolved SEO block and the VideoObject structured data built
        // from it on the storefront.
        const seo = await this.seo.resolve('PROMO_VIDEO', video.id, locale, {
          title: video.title,
          description: product?.description ?? null,
          canonicalPath: '/',
          imageUrl: video.thumbnailUrl,
        });
        const structuredData = [
          buildVideoObjectJsonLd({
            name: seo.title,
            description: seo.description,
            thumbnailUrl: video.thumbnailUrl,
            videoUrl: video.url,
            uploadDate: video.createdAt,
          }),
        ];
        return toPublicPromoVideoDto(video, product, seo, structuredData);
      }),
    );
  }
}
