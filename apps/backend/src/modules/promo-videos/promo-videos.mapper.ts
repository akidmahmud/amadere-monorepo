import { PromoVideo, PromoVideoSource } from '@amader/db';
import { PublicProductDto } from '../products/dto/product-response.dto';
import { ResolvedSeoDto } from '../seo/seo.mapper';

export class AdminPromoVideoDto {
  id!: number;
  title!: string;
  source!: PromoVideoSource;
  url!: string;
  durationSeconds!: number | null;
  thumbnailUrl!: string | null;
  productId!: number | null;
  sortOrder!: number;
  showInHomepage!: boolean;
  createdAt!: Date;
}

export function toAdminPromoVideoDto(video: PromoVideo): AdminPromoVideoDto {
  return {
    id: video.id,
    title: video.title,
    source: video.source,
    url: video.url,
    durationSeconds: video.durationSeconds,
    thumbnailUrl: video.thumbnailUrl,
    productId: video.productId,
    sortOrder: video.sortOrder,
    showInHomepage: video.showInHomepage,
    createdAt: video.createdAt,
  };
}

export class PublicPromoVideoDto {
  id!: number;
  title!: string;
  source!: PromoVideoSource;
  url!: string;
  durationSeconds!: number | null;
  thumbnailUrl!: string | null;
  product!: PublicProductDto | null;
  seo!: ResolvedSeoDto;
  structuredData!: Record<string, unknown>[];
}

export function toPublicPromoVideoDto(
  video: PromoVideo,
  product: PublicProductDto | null,
  seo: ResolvedSeoDto,
  structuredData: Record<string, unknown>[],
): PublicPromoVideoDto {
  return {
    id: video.id,
    title: video.title,
    source: video.source,
    url: video.url,
    durationSeconds: video.durationSeconds,
    thumbnailUrl: video.thumbnailUrl,
    product,
    seo,
    structuredData,
  };
}
