import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginationArgs,
  toPaginatedResult,
} from '../../common/pagination.util';
import { CreateGiftVoucherDto } from './dto/create-gift-voucher.dto';
import {
  GiftVoucherCheckDto,
  GiftVoucherDto,
  toVoucherDto,
} from './gift-vouchers.mapper';

@Injectable()
export class GiftVouchersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<GiftVoucherDto>> {
    const [items, total] = await Promise.all([
      this.prisma.client.giftVoucher.findMany({
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.giftVoucher.count(),
    ]);
    return toPaginatedResult(items.map(toVoucherDto), total, page, pageSize);
  }

  async create(dto: CreateGiftVoucherDto): Promise<GiftVoucherDto> {
    const code =
      dto.code ?? `GV-${randomBytes(6).toString('hex').toUpperCase()}`;
    const existing = await this.prisma.client.giftVoucher.findUnique({
      where: { code },
    });
    if (existing)
      throw new ConflictException(`Code "${code}" is already in use`);

    const voucher = await this.prisma.client.giftVoucher.create({
      data: {
        code,
        initialBalance: dto.initialBalance,
        remainingBalance: dto.initialBalance,
        expiresAt: dto.expiresAt,
        purchasedByCustomerId: dto.purchasedByCustomerId,
      },
    });
    return toVoucherDto(voucher);
  }

  async deactivate(id: number): Promise<GiftVoucherDto> {
    const voucher = await this.prisma.client.giftVoucher.findUnique({
      where: { id },
    });
    if (!voucher) throw new NotFoundException('Voucher not found');
    const updated = await this.prisma.client.giftVoucher.update({
      where: { id },
      data: { status: 'EXPIRED' },
    });
    return toVoucherDto(updated);
  }

  // Public: lets checkout UI show remaining balance before redemption (which
  // itself happens in B6 as part of order placement).
  async check(code: string): Promise<GiftVoucherCheckDto> {
    const voucher = await this.prisma.client.giftVoucher.findUnique({
      where: { code },
    });
    if (!voucher) throw new NotFoundException('Voucher not found');

    const expired =
      voucher.status !== 'ACTIVE' ||
      (voucher.expiresAt !== null && voucher.expiresAt < new Date());
    return {
      code: voucher.code,
      remainingBalance: voucher.remainingBalance.toString(),
      currency: voucher.currency,
      usable: !expired && voucher.remainingBalance.greaterThan(0),
    };
  }
}
