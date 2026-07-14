import { BlockRule } from '@amader/db';

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
  expiresAt!: Date | null;
  createdBy!: number | null;
  createdAt!: Date;
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
    expiresAt: row.expiresAt,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}
