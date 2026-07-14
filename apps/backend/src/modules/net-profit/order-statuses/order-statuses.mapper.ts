import { OrderStatusConfig } from '@amader/db';

export class OrderStatusConfigDto {
  status!: string;
  labelEn!: string;
  labelBn!: string;
  color!: string;
  sortOrder!: number;
}

export function toOrderStatusConfigDto(row: OrderStatusConfig): OrderStatusConfigDto {
  return {
    status: row.status,
    labelEn: row.labelEn,
    labelBn: row.labelBn,
    color: row.color,
    sortOrder: row.sortOrder,
  };
}
