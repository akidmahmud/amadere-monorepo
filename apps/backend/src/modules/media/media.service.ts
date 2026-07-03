import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { imageSize } from 'image-size';
import { MediaType } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginationArgs,
  toPaginatedResult,
} from '../../common/pagination.util';
import { MEDIA_STORAGE } from './storage/media-storage.interface';
import type { MediaStorage } from './storage/media-storage.interface';
import { MediaDto, toMediaDto } from './media.mapper';

function mediaTypeFromMime(mimeType: string): MediaType {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  throw new BadRequestException(`Unsupported media mime type: ${mimeType}`);
}

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  async upload(file: Express.Multer.File, altText?: string): Promise<MediaDto> {
    const type = mediaTypeFromMime(file.mimetype);

    let width: number | undefined;
    let height: number | undefined;
    if (type === 'IMAGE') {
      try {
        const size = imageSize(file.buffer);
        width = size.width;
        height = size.height;
      } catch {
        // Not a decodable image format (e.g. SVG) — dimensions stay unset.
      }
    }

    const key = `${type.toLowerCase()}/${randomUUID()}-${file.originalname}`;
    const { url } = await this.storage.upload(key, file.buffer, file.mimetype);

    const media = await this.prisma.client.media.create({
      data: { url, type, altText, width, height },
    });
    return toMediaDto(media);
  }

  async list(page: number, pageSize: number) {
    const [items, total] = await Promise.all([
      this.prisma.client.media.findMany({
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.media.count(),
    ]);
    return toPaginatedResult(items.map(toMediaDto), total, page, pageSize);
  }

  async delete(id: number): Promise<void> {
    const media = await this.prisma.client.media.findUnique({
      where: { id },
      include: { _count: { select: { productMedia: true } } },
    });
    if (!media) throw new NotFoundException('Media not found');
    if (media._count.productMedia > 0) {
      throw new ConflictException(
        'Media is still attached to one or more products',
      );
    }

    const key = media.url.split('/').slice(-2).join('/');
    await this.storage.delete(key);
    await this.prisma.client.media.delete({ where: { id } });
  }
}
