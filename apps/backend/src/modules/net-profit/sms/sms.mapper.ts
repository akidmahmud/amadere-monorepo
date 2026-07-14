import { SmsLog, SmsTemplate } from '@amader/db';

export class SmsTemplateDto {
  id!: number;
  key!: string;
  bodyEn!: string;
  bodyBn!: string;
  enabled!: boolean;
}

export function toSmsTemplateDto(row: SmsTemplate): SmsTemplateDto {
  return { id: row.id, key: row.key, bodyEn: row.bodyEn, bodyBn: row.bodyBn, enabled: row.enabled };
}

export class SmsLogDto {
  id!: number;
  to!: string;
  body!: string;
  templateKey!: string | null;
  status!: string;
  provider!: string;
  cost!: string | null;
  createdAt!: Date;
}

export function toSmsLogDto(row: SmsLog): SmsLogDto {
  return {
    id: row.id,
    to: row.to,
    body: row.body,
    templateKey: row.templateKey,
    status: row.status,
    provider: row.provider,
    cost: row.cost ? row.cost.toString() : null,
    createdAt: row.createdAt,
  };
}
