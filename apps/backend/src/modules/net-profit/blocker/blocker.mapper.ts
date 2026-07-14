import { BlockRule } from '@amader/db';

export type BlockRuleStatus = 'active' | 'unblocked' | 'expired';

export class BlockRuleDto {
  id!: number;
  type!: string;
  value!: string;
  source!: string;
  category!: string | null;
  customerName!: string | null;
  addressText!: string | null;
  reason!: string | null;
  note!: string | null;
  isActive!: boolean;
  status!: BlockRuleStatus;
  expiresAt!: Date | null;
  metadata!: Record<string, unknown> | null;
  createdBy!: number | null;
  createdAt!: Date;
}

export function ruleStatus(row: Pick<BlockRule, 'isActive' | 'expiresAt'>): BlockRuleStatus {
  if (!row.isActive) return 'unblocked';
  if (row.expiresAt && row.expiresAt < new Date()) return 'expired';
  return 'active';
}

export function toBlockRuleDto(row: BlockRule): BlockRuleDto {
  return {
    id: row.id,
    type: row.type,
    value: row.value,
    source: row.source,
    category: row.category,
    customerName: row.customerName,
    addressText: row.addressText,
    reason: row.reason,
    note: row.note,
    isActive: row.isActive,
    status: ruleStatus(row),
    expiresAt: row.expiresAt,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}
