import { Media } from '@amader/db';

export class MediaDto {
  id!: number;
  url!: string;
  type!: string;
  altText!: string | null;
  width!: number | null;
  height!: number | null;
}

export function toMediaDto(media: Media): MediaDto {
  return {
    id: media.id,
    url: media.url,
    type: media.type,
    altText: media.altText,
    width: media.width,
    height: media.height,
  };
}
