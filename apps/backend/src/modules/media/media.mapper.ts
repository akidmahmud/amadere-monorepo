import { Media, MediaFolder } from '@amader/db';

export class MediaDto {
  id!: number;
  url!: string;
  type!: string;
  altText!: string | null;
  width!: number | null;
  height!: number | null;
  folderId!: number | null;
}

export function toMediaDto(media: Media): MediaDto {
  return {
    id: media.id,
    url: media.url,
    type: media.type,
    altText: media.altText,
    width: media.width,
    height: media.height,
    folderId: media.folderId,
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
