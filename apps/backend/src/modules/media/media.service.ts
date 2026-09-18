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
import type { Media, MediaFolder } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginationArgs,
  toPaginatedResult,
} from '../../common/pagination.util';
import { generateImageDerivatives } from '@amader/shared/image-derivatives';
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

// The storage key becomes the public URL verbatim, so anything not safe in a
// URL path breaks the image. `file.originalname` is whatever the customer's
// file was called — "Sorishar tel Banner.webp", "ChatGPT Image Jul 16, 2026,
// 10_43_41 AM.png" — and a raw space makes a URL the browser cannot fetch, so
// the upload succeeds and the thumbnail renders blank forever after.
//
// The key already carries a randomUUID for uniqueness, so the original name
// is purely cosmetic here and safe to mangle. Kept readable rather than
// dropped entirely, because it is the only human hint of what a file is.
export function sanitizeFilename(originalname: string): string {
  const dot = originalname.lastIndexOf('.');
  const stem = dot > 0 ? originalname.slice(0, dot) : originalname;
  const ext = dot > 0 ? originalname.slice(dot + 1) : '';
  const clean = (part: string) =>
    part
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '');
  // A name that is entirely non-ASCII (e.g. all Bengali) sanitizes to an
  // empty string — fall back rather than emit a key ending in a bare dash.
  const safeStem = clean(stem).slice(0, 80) || 'file';
  const safeExt = clean(ext).toLowerCase();
  return safeExt ? `${safeStem}.${safeExt}` : safeStem;
}

/** Storage key from a public URL: its last two segments (`image/<uuid>-name.png`). */
const keyOf = (url: string) => url.split('/').slice(-2).join('/');

const LEADING_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=-)/i;

/** The same key under a new UUID — how a duplicated file gets its own object. */
export function rekey(key: string, newId: string): string {
  const slash = key.lastIndexOf('/');
  const dir = key.slice(0, slash + 1);
  const file = key.slice(slash + 1);
  return LEADING_UUID.test(file) ? dir + file.replace(LEADING_UUID, newId) : `${dir}${newId}-${file}`;
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

    const id = randomUUID();
    const key = `${type.toLowerCase()}/${id}-${sanitizeFilename(file.originalname)}`;
    const { url } = await this.storage.upload(key, file.buffer, file.mimetype);

    // Card/full WebP derivatives — original stays as uploaded (untouched,
    // per explicit decision to keep it as a re-derive source), these are
    // additional objects alongside it. null for VIDEO and anything sharp
    // can't decode (SVG) — cardUrl/fullUrl just stay unset and every
    // consumer already falls back to `url`.
    let cardUrl: string | undefined;
    let fullUrl: string | undefined;
    if (type === 'IMAGE') {
      const derivatives = await generateImageDerivatives(file.buffer);
      if (derivatives) {
        const [card, full] = await Promise.all([
          this.storage.upload(`image/${id}-card.webp`, derivatives.card.buffer, derivatives.card.contentType),
          this.storage.upload(`image/${id}-full.webp`, derivatives.full.buffer, derivatives.full.contentType),
        ]);
        cardUrl = card.url;
        fullUrl = full.url;
      }
    }

    const media = await this.prisma.client.media.create({
      data: { url, cardUrl, fullUrl, type, altText, width, height },
    });
    return toMediaDto(media);
  }

  // Uploads to storage without creating a `Media` library row — for
  // customer-submitted files (e.g. manual-payment screenshots) that
  // shouldn't clutter the admin's product-image picker.
  async uploadTransient(file: Express.Multer.File): Promise<string> {
    const type = mediaTypeFromMime(file.mimetype);
    const key = `${type.toLowerCase()}/${randomUUID()}-${sanitizeFilename(file.originalname)}`;
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
      data: {
        altText: dto.altText,
        folderId: dto.folderId,
        // Display name only — the URL never changes. Blank clears it back to
        // the file name taken from the URL.
        name: dto.name === undefined ? undefined : dto.name?.trim() || null,
      },
    });
    return toMediaDto(updated);
  }

  async listFolders(): Promise<MediaFolderDto[]> {
    const folders = await this.prisma.client.mediaFolder.findMany({ orderBy: { name: 'asc' } });
    return folders.map(toMediaFolderDto);
  }

  async createFolder(name: string, parentId?: number): Promise<MediaFolderDto> {
    // Checked rather than left to the FK: a bad parentId would otherwise
    // surface as a raw Prisma constraint error instead of a 404.
    if (parentId !== undefined) {
      const parent = await this.prisma.client.mediaFolder.findUnique({ where: { id: parentId } });
      if (!parent) throw new NotFoundException('Parent folder not found');
    }
    const folder = await this.prisma.client.mediaFolder.create({
      data: { name, parentId: parentId ?? null },
    });
    return toMediaFolderDto(folder);
  }

  async renameFolder(id: number, name: string): Promise<MediaFolderDto> {
    const folder = await this.prisma.client.mediaFolder.findUnique({ where: { id } });
    if (!folder) throw new NotFoundException('Folder not found');
    const updated = await this.prisma.client.mediaFolder.update({
      where: { id },
      data: { name: name.trim() },
    });
    return toMediaFolderDto(updated);
  }

  /**
   * "<name> (copy)" beside the original, with every subfolder and file inside.
   * Files are physically copied in R2 under new keys (never shared), because
   * deleting a Media row deletes its objects — a shared URL would break the
   * other copy. Storage goes first: if any copy fails, what was copied is
   * removed and nothing is saved, so there is never a half-built folder.
   */
  // ponytail: copies run in-request, one file at a time — fine for a few
  // hundred files; move to a background job if folders get much larger.
  async duplicateFolder(id: number): Promise<MediaFolderDto> {
    const all = await this.prisma.client.mediaFolder.findMany();
    const root = all.find((f) => f.id === id);
    if (!root) throw new NotFoundException('Folder not found');

    // Parents before children, so each copy's parent exists when it's created.
    const order = [root];
    for (let i = 0; i < order.length; i++) {
      order.push(...all.filter((f) => f.parentId === order[i].id));
    }
    const media = await this.prisma.client.media.findMany({
      where: { folderId: { in: order.map((f) => f.id) } },
      orderBy: { id: 'asc' },
    });

    const taken = new Set(all.filter((f) => f.parentId === root.parentId).map((f) => f.name));
    let name = `${root.name} (copy)`;
    for (let n = 2; taken.has(name); n++) name = `${root.name} (copy ${n})`;

    const copied: string[] = [];
    try {
      const copies: { src: Media; url: string; cardUrl: string | null; fullUrl: string | null }[] = [];
      for (const m of media) {
        const newId = randomUUID();
        const dup = async (url: string | null) => {
          if (!url) return null;
          const to = rekey(keyOf(url), newId);
          const res = await this.storage.copy(keyOf(url), to);
          copied.push(to);
          return res.url;
        };
        copies.push({
          src: m,
          url: (await dup(m.url)) as string,
          cardUrl: await dup(m.cardUrl),
          fullUrl: await dup(m.fullUrl),
        });
      }

      return await this.prisma.client.$transaction(async (tx) => {
        const newIds = new Map<number, number>();
        let rootCopy: MediaFolder | undefined;
        for (const f of order) {
          const created = await tx.mediaFolder.create({
            data:
              f.id === root.id
                ? { name, parentId: root.parentId }
                : { name: f.name, parentId: newIds.get(f.parentId as number) as number },
          });
          newIds.set(f.id, created.id);
          rootCopy ??= created;
        }
        for (const c of copies) {
          await tx.media.create({
            data: {
              url: c.url,
              cardUrl: c.cardUrl,
              fullUrl: c.fullUrl,
              type: c.src.type,
              altText: c.src.altText,
              name: c.src.name,
              width: c.src.width,
              height: c.src.height,
              folderId: newIds.get(c.src.folderId as number) as number,
            },
          });
        }
        return toMediaFolderDto(rootCopy as MediaFolder);
      });
    } catch (err) {
      await Promise.allSettled(copied.map((k) => this.storage.delete(k)));
      throw err;
    }
  }

  async deleteFolder(id: number): Promise<void> {
    const folder = await this.prisma.client.mediaFolder.findUnique({ where: { id } });
    if (!folder) throw new NotFoundException('Folder not found');
    // Media inside is un-filed (schema's onDelete: SetNull), never deleted —
    // a folder is just an organizational label, not a container that owns
    // the files' lifecycle. Subfolders DO go, via the self-relation's
    // onDelete: Cascade; their media is un-filed the same way.
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

    const urls = [media.url, media.cardUrl, media.fullUrl].filter(
      (u): u is string => u !== null && u !== undefined,
    );
    await Promise.all(urls.map((u) => this.storage.delete(keyOf(u))));
    await this.prisma.client.media.delete({ where: { id } });
  }
}
