import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface PosCouponInput {
  code: string;
  valueType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: number;
  minOrderAmount?: number | null;
  /** null / omitted = every store. */
  storeId?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  maxUsesTotal?: number | null;
  maxUsesPerCustomer?: number | null;
  active: boolean;
}

/**
 * Coupons made in POS Settings: ordinary Discount rows with channel POS, so
 * the existing validation, usage limits and redemption tracking all apply —
 * and couponChannelError keeps them off the website checkout.
 */
@Injectable()
export class PosCouponsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.client.discount.findMany({
      where: { channel: 'POS', type: 'COUPON' },
      include: { store: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private toData(input: PosCouponInput) {
    const code = input.code.trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,30}$/.test(code)) {
      throw new BadRequestException('Code: 3–30 letters, digits or dashes');
    }
    if (!(input.value > 0))
      throw new BadRequestException('Value must be more than 0');
    if (input.valueType === 'PERCENTAGE' && input.value > 100) {
      throw new BadRequestException('A percentage can be at most 100');
    }
    const startsAt = input.startsAt ? new Date(input.startsAt) : null;
    const endsAt = input.endsAt
      ? new Date(`${input.endsAt.slice(0, 10)}T23:59:59.999+06:00`)
      : null;
    if (startsAt && endsAt && endsAt < startsAt) {
      throw new BadRequestException('The end date is before the start date');
    }
    return {
      code,
      type: 'COUPON' as const,
      channel: 'POS' as const,
      valueType: input.valueType,
      value: new Prisma.Decimal(input.value),
      minOrderAmount: input.minOrderAmount
        ? new Prisma.Decimal(input.minOrderAmount)
        : null,
      storeId: input.storeId ?? null,
      startsAt,
      endsAt,
      maxUsesTotal: input.maxUsesTotal || null,
      maxUsesPerCustomer: input.maxUsesPerCustomer || null,
      status: input.active ? ('PUBLISHED' as const) : ('DRAFT' as const),
    };
  }

  private async assertCodeFree(code: string, exceptId?: number) {
    const other = await this.prisma.client.discount.findUnique({
      where: { code },
    });
    if (other && other.id !== exceptId)
      throw new ConflictException(`The code ${code} is already used`);
  }

  private async getPos(id: number) {
    const d = await this.prisma.client.discount.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Coupon not found');
    if (d.channel !== 'POS')
      throw new BadRequestException(
        'This is not a POS coupon — edit it under Marketing › Discounts',
      );
    return d;
  }

  async create(input: PosCouponInput) {
    const data = this.toData(input);
    await this.assertCodeFree(data.code);
    return this.prisma.client.discount.create({ data });
  }

  async update(id: number, input: PosCouponInput) {
    await this.getPos(id);
    const data = this.toData(input);
    await this.assertCodeFree(data.code, id);
    return this.prisma.client.discount.update({ where: { id }, data });
  }

  /**
   * Coupons a cashier can apply at this store right now — shown in a list at
   * the till so nobody has to remember codes. Only what the till needs is
   * returned (no usage counts or limits). Customer-specific codes are left out.
   */
  async available(storeId: number, now = new Date()) {
    const rows = await this.prisma.client.discount.findMany({
      where: {
        type: 'COUPON',
        status: 'PUBLISHED',
        code: { not: null },
        customers: { none: {} },
        // Free shipping means nothing at a counter.
        valueType: { in: ['PERCENTAGE', 'FIXED_AMOUNT'] },
        AND: [
          { OR: [{ storeId: null }, { storeId }] },
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    const rank = (d: { storeId: number | null; channel: string }) =>
      d.storeId === storeId ? 0 : d.channel === 'POS' ? 1 : 2;
    return rows
      .filter((d) => d.maxUsesTotal === null || d.usedCount < d.maxUsesTotal)
      .sort((a, b) => rank(a) - rank(b))
      .map((d) => ({
        code: d.code as string,
        valueType: d.valueType,
        value: d.value.toString(),
        minOrderAmount: d.minOrderAmount?.toString() ?? null,
        endsAt: d.endsAt,
        scope: (['store', 'pos', 'all'] as const)[rank(d)],
      }));
  }

  /** Only never-used codes are deleted; a used one is switched off instead, keeping its history. */
  async remove(id: number): Promise<void> {
    const d = await this.getPos(id);
    if (d.usedCount > 0)
      throw new BadRequestException(
        'This code has been used — switch it off instead of deleting',
      );
    await this.prisma.client.discount.delete({ where: { id } });
  }
}
