import { CartCampaignLog, CartCampaignQueue, CartCampaignTemplate } from '@amader/db';

export class CartCampaignTemplateDto {
  id!: number;
  channel!: string;
  name!: string;
  subject!: string | null;
  bodyEn!: string;
  bodyBn!: string;
  delayValue!: number;
  delayUnit!: string;
  status!: string;
}

export function toCartCampaignTemplateDto(row: CartCampaignTemplate): CartCampaignTemplateDto {
  return {
    id: row.id,
    channel: row.channel,
    name: row.name,
    subject: row.subject,
    bodyEn: row.bodyEn,
    bodyBn: row.bodyBn,
    delayValue: row.delayValue,
    delayUnit: row.delayUnit,
    status: row.status,
  };
}

export class CartCampaignQueueDto {
  id!: number;
  incompleteId!: number;
  templateId!: number;
  channel!: string;
  recipient!: string | null;
  status!: string;
  attempts!: number;
  scheduledAt!: Date;
  processedAt!: Date | null;
  lastError!: string | null;
}

export function toCartCampaignQueueDto(row: CartCampaignQueue): CartCampaignQueueDto {
  return {
    id: row.id,
    incompleteId: row.incompleteId,
    templateId: row.templateId,
    channel: row.channel,
    recipient: row.recipient,
    status: row.status,
    attempts: row.attempts,
    scheduledAt: row.scheduledAt,
    processedAt: row.processedAt,
    lastError: row.lastError,
  };
}

export class CartCampaignLogDto {
  id!: number;
  incompleteId!: number;
  channel!: string;
  recipient!: string | null;
  subject!: string | null;
  message!: string;
  status!: string;
  sentAt!: Date;
}

export function toCartCampaignLogDto(row: CartCampaignLog): CartCampaignLogDto {
  return {
    id: row.id,
    incompleteId: row.incompleteId,
    channel: row.channel,
    recipient: row.recipient,
    subject: row.subject,
    message: row.message,
    status: row.status,
    sentAt: row.sentAt,
  };
}
