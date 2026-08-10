import { NewsletterSegment, NewsletterSegmentType } from '@amader/db';

export class AdminNewsletterSegmentDto {
  id!: number;
  name!: string;
  type!: NewsletterSegmentType;
  tagId!: number | null;
  days!: number | null;
  createdAt!: Date;
}

export function toAdminNewsletterSegmentDto(segment: NewsletterSegment): AdminNewsletterSegmentDto {
  return {
    id: segment.id,
    name: segment.name,
    type: segment.type,
    tagId: segment.tagId,
    days: segment.days,
    createdAt: segment.createdAt,
  };
}
