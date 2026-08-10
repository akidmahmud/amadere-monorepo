import { NewsletterTemplate } from '@amader/db';
import { EmailContentJson, EMPTY_EMAIL_CONTENT } from '../../common/newsletter/email-renderer.util';

export class AdminNewsletterTemplateDto {
  id!: number;
  name!: string;
  description!: string | null;
  contentJson!: EmailContentJson;
  createdAt!: Date;
  updatedAt!: Date;
}

export function toAdminNewsletterTemplateDto(template: NewsletterTemplate): AdminNewsletterTemplateDto {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    contentJson: (template.contentJson as unknown as EmailContentJson) ?? EMPTY_EMAIL_CONTENT,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}
