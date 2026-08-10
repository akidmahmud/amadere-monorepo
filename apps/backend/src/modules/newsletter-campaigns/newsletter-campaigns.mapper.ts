import { NewsletterCampaign, NewsletterCampaignStatus } from '@amader/db';
import { EmailContentJson, EMPTY_EMAIL_CONTENT } from '../../common/newsletter/email-renderer.util';

export class AdminNewsletterCampaignDto {
  id!: number;
  name!: string;
  subject!: string;
  previewText!: string | null;
  fromName!: string | null;
  fromEmail!: string | null;
  replyTo!: string | null;
  contentJson!: EmailContentJson;
  status!: NewsletterCampaignStatus;
  totalRecipients!: number;
  totalSent!: number;
  totalFailed!: number;
  totalOpened!: number;
  totalClicked!: number;
  startedAt!: Date | null;
  completedAt!: Date | null;
  scheduledAt!: Date | null;
  segmentId!: number | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export function toAdminNewsletterCampaignDto(campaign: NewsletterCampaign): AdminNewsletterCampaignDto {
  return {
    id: campaign.id,
    name: campaign.name,
    subject: campaign.subject,
    previewText: campaign.previewText,
    fromName: campaign.fromName,
    fromEmail: campaign.fromEmail,
    replyTo: campaign.replyTo,
    contentJson: (campaign.contentJson as unknown as EmailContentJson) ?? EMPTY_EMAIL_CONTENT,
    status: campaign.status,
    totalRecipients: campaign.totalRecipients,
    totalSent: campaign.totalSent,
    totalFailed: campaign.totalFailed,
    totalOpened: campaign.totalOpened,
    totalClicked: campaign.totalClicked,
    startedAt: campaign.startedAt,
    completedAt: campaign.completedAt,
    scheduledAt: campaign.scheduledAt,
    segmentId: campaign.segmentId,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
}
