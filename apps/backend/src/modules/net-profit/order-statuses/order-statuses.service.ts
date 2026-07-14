import { Injectable, OnModuleInit } from '@nestjs/common';
import { OrderStatus } from '@amader/db';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { OrderStatusConfigDto, toOrderStatusConfigDto } from './order-statuses.mapper';

const DEFAULTS: { status: OrderStatus; labelEn: string; labelBn: string; color: string; sortOrder: number }[] = [
  { status: 'PENDING', labelEn: 'Pending', labelBn: 'অপেক্ষমাণ', color: '#9ca3af', sortOrder: 0 },
  { status: 'CONFIRMED', labelEn: 'Confirmed', labelBn: 'নিশ্চিত করা হয়েছে', color: '#0c8ce9', sortOrder: 1 },
  { status: 'PROCESSING', labelEn: 'Processing', labelBn: 'প্রক্রিয়াধীন', color: '#f5a623', sortOrder: 2 },
  { status: 'HOLD', labelEn: 'On Hold', labelBn: 'স্থগিত', color: '#8b5cf6', sortOrder: 3 },
  { status: 'COMPLETED', labelEn: 'Completed', labelBn: 'সম্পন্ন', color: '#22b07d', sortOrder: 4 },
  { status: 'PARTIALLY_RETURNED', labelEn: 'Partially Returned', labelBn: 'আংশিক ফেরত', color: '#f97316', sortOrder: 5 },
  { status: 'RETURNED', labelEn: 'Returned', labelBn: 'ফেরত', color: '#e5484d', sortOrder: 6 },
  { status: 'CANCELED', labelEn: 'Canceled', labelBn: 'বাতিল', color: '#e5484d', sortOrder: 7 },
];

// ADDENDUM §K — label/color layer over the real OrderStatus enum (see
// schema comment). Seeded idempotently on boot, same pattern as M3's SMS
// templates, so a fresh environment always has a full, editable set.
@Injectable()
export class OrderStatusesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    for (const d of DEFAULTS) {
      await this.prisma.client.orderStatusConfig.upsert({
        where: { status: d.status },
        create: d,
        update: {},
      });
    }
  }

  async list(): Promise<OrderStatusConfigDto[]> {
    const rows = await this.prisma.client.orderStatusConfig.findMany({ orderBy: { sortOrder: 'asc' } });
    return rows.map(toOrderStatusConfigDto);
  }

  async update(
    status: OrderStatus,
    dto: { labelEn?: string; labelBn?: string; color?: string; sortOrder?: number },
  ): Promise<OrderStatusConfigDto> {
    const row = await this.prisma.client.orderStatusConfig.update({ where: { status }, data: dto });
    return toOrderStatusConfigDto(row);
  }
}
