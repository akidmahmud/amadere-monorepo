import { NewsletterTag } from '@amader/db';

export class AdminNewsletterTagDto {
  id!: number;
  name!: string;
  createdAt!: Date;
}

export function toAdminNewsletterTagDto(tag: NewsletterTag): AdminNewsletterTagDto {
  return { id: tag.id, name: tag.name, createdAt: tag.createdAt };
}
