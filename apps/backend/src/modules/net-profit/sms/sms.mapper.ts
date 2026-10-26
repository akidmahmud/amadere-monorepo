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
  code!: number | null;
  codeMessage!: string | null;
  /** Why a FAILED send failed, when the gateway gave no code (SMS off, not configured, unreachable). */
  error!: string | null;
  createdAt!: Date;
}

export function toSmsLogDto(row: SmsLog): SmsLogDto {
  const meta = (row.meta as { code?: number; codeMessage?: string; error?: string; reason?: string } | null) ?? null;
  return {
    id: row.id,
    to: row.to,
    body: row.body,
    templateKey: row.templateKey,
    status: row.status,
    provider: row.provider,
    cost: row.cost ? row.cost.toString() : null,
    code: meta?.code ?? null,
    codeMessage: meta?.codeMessage ?? null,
    error:
      meta?.error ??
      (meta?.reason === 'sms_disabled' ? 'SMS sending is turned off (SMS → Settings)' : null),
    createdAt: row.createdAt,
  };
}
