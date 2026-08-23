import { Media, MediaFolder } from '@amader/db';

export class MediaDto {
  id!: number;
  url!: string;
  /** ~400w WebP for grid/list thumbnails. Null until the derivative pipeline
   * has processed this row (new uploads always have it; pre-existing rows
   * need the backfill script) — consumers fall back to `url`. */
  cardUrl!: string | null;
  /** ~1200w-capped WebP for PDP/hero placements. Same null/fallback rule. */
  fullUrl!: string | null;
  type!: string;
  altText!: string | null;
  width!: number | null;
  height!: number | null;
  folderId!: number | null;
  /** Column has always existed; exposed so the library's details panel can
   * show when a file was uploaded. */
  createdAt!: Date;
}

export function toMediaDto(media: Media): MediaDto {
  return {
    id: media.id,
    url: media.url,
    cardUrl: media.cardUrl,
    fullUrl: media.fullUrl,
    type: media.type,
    altText: media.altText,
    width: media.width,
    height: media.height,
    folderId: media.folderId,
    createdAt: media.createdAt,
  };
}

export class MediaFolderDto {
  id!: number;
  name!: string;
  createdAt!: Date;
}

export function toMediaFolderDto(folder: MediaFolder): MediaFolderDto {
  return {
    id: folder.id,
    name: folder.name,
    createdAt: folder.createdAt,
  };
}
