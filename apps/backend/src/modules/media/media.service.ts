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
import { MediaDto, MediaFolderDto, toMediaDto, toMediaFolderDto } from './media.mapper';
import { MediaQueryDto } from './dto/media-query.dto';
import { UpdateMediaDto } from './dto/update-media.dto';

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

  // Uploads to storage without creating a `Media` library row — for
  // customer-submitted files (e.g. manual-payment screenshots) that
  // shouldn't clutter the admin's product-image picker.
  async uploadTransient(file: Express.Multer.File): Promise<string> {
    const type = mediaTypeFromMime(file.mimetype);
    const key = `${type.toLowerCase()}/${randomUUID()}-${file.originalname}`;
    const { url } = await this.storage.upload(key, file.buffer, file.mimetype);
    return url;
  }

  async list(query: MediaQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = query.folderId !== undefined ? { folderId: query.folderId } : query.unfiled ? { folderId: null } : {};
    const [items, total] = await Promise.all([
      this.prisma.client.media.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.media.count({ where }),
    ]);
    return toPaginatedResult(items.map(toMediaDto), total, page, pageSize);
  }

  async update(id: number, dto: UpdateMediaDto): Promise<MediaDto> {
    const media = await this.prisma.client.media.findUnique({ where: { id } });
    if (!media) throw new NotFoundException('Media not found');
    if (dto.folderId != null) {
      const folder = await this.prisma.client.mediaFolder.findUnique({ where: { id: dto.folderId } });
      if (!folder) throw new NotFoundException('Folder not found');
    }
    const updated = await this.prisma.client.media.update({
      where: { id },
      data: { altText: dto.altText, folderId: dto.folderId },
    });
    return toMediaDto(updated);
  }

  async listFolders(): Promise<MediaFolderDto[]> {
    const folders = await this.prisma.client.mediaFolder.findMany({ orderBy: { name: 'asc' } });
    return folders.map(toMediaFolderDto);
  }

  async createFolder(name: string): Promise<MediaFolderDto> {
    const folder = await this.prisma.client.mediaFolder.create({ data: { name } });
    return toMediaFolderDto(folder);
  }

  async deleteFolder(id: number): Promise<void> {
    const folder = await this.prisma.client.mediaFolder.findUnique({ where: { id } });
    if (!folder) throw new NotFoundException('Folder not found');
    // Media inside is un-filed (schema's onDelete: SetNull), never deleted —
    // a folder is just an organizational label, not a container that owns
    // the files' lifecycle.
    await this.prisma.client.mediaFolder.delete({ where: { id } });
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
