import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AdvanceStatus, Prisma } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { paginationArgs, toPaginatedResult } from '../../../common/pagination.util';
import { ORDER_STATUS_CHANGED_EVENT } from '../../orders/orders.events';
import type { OrderStatusChangedEvent } from '../../orders/orders.events';
import { AdvancePaymentDto, toAdvancePaymentDto } from './advance-payment.mapper';

const Decimal = Prisma.Decimal;

// Updates Order.status directly via Prisma rather than injecting
// OrdersService, which would create OrdersModule -> AdvancePaymentModule ->
// OrdersModule (checkout needs this service too, for the fraud "advance"
// action). Still writes a real OrderStatusHistory row and emits the real
// ORDER_STATUS_CHANGED_EVENT by hand, so SMS triggers (M3) and any other
// listener still fire — just without going through OrdersService itself.
@Injectable()
export class AdvancePaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async require(orderId: number, required: Prisma.Decimal, reason?: string): Promise<AdvancePaymentDto> {
    if (required.lessThanOrEqualTo(0)) throw new BadRequestException('Required amount must be greater than zero');

    const order = await this.prisma.client.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const row = await this.prisma.client.advancePayment.upsert({
      where: { orderId },
      create: { orderId, required, reason, status: 'PENDING' },
      update: { required, reason, status: 'PENDING', paid: 0 },
    });

    await this.setOrderStatus(orderId, order.status, 'HOLD', 'Advance payment required');
    return toAdvancePaymentDto(row);
  }

  async record(orderId: number, paidAmount: Prisma.Decimal): Promise<AdvancePaymentDto> {
    const existing = await this.prisma.client.advancePayment.findUnique({ where: { orderId } });
    if (!existing) throw new NotFoundException('No advance payment required for this order');

    const paid = existing.paid.plus(paidAmount);
    const status: AdvanceStatus = paid.greaterThanOrEqualTo(existing.required) ? 'PAID' : paid.greaterThan(0) ? 'PARTIAL' : 'PENDING';

    const row = await this.prisma.client.advancePayment.update({
      where: { orderId },
      data: { paid, status },
    });

    if (status === 'PAID') {
      const order = await this.prisma.client.order.findUnique({ where: { id: orderId } });
      if (order?.status === 'HOLD') {
        await this.setOrderStatus(orderId, 'HOLD', 'CONFIRMED', 'Advance payment received — hold released');
      }
    }

    return toAdvancePaymentDto(row);
  }

  async waive(orderId: number): Promise<AdvancePaymentDto> {
    const existing = await this.prisma.client.advancePayment.findUnique({ where: { orderId } });
    if (!existing) throw new NotFoundException('No advance payment required for this order');

    const row = await this.prisma.client.advancePayment.update({
      where: { orderId },
      data: { status: 'WAIVED' },
    });

    const order = await this.prisma.client.order.findUnique({ where: { id: orderId } });
    if (order?.status === 'HOLD') {
      await this.setOrderStatus(orderId, 'HOLD', 'CONFIRMED', 'Advance payment waived — hold released');
    }
    return toAdvancePaymentDto(row);
  }

  async get(orderId: number): Promise<AdvancePaymentDto | null> {
    const row = await this.prisma.client.advancePayment.findUnique({ where: { orderId } });
    return row ? toAdvancePaymentDto(row) : null;
  }

  async list(page: number, pageSize: number, status?: AdvanceStatus): Promise<PaginatedResult<AdvancePaymentDto>> {
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.client.advancePayment.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginationArgs(page, pageSize) }),
      this.prisma.client.advancePayment.count({ where }),
    ]);
    return toPaginatedResult(items.map(toAdvancePaymentDto), total, page, pageSize);
  }

  private async setOrderStatus(orderId: number, from: string, to: 'HOLD' | 'CONFIRMED', note: string): Promise<void> {
    await this.prisma.client.order.update({
      where: { id: orderId },
      data: {
        status: to,
        statusHistory: { create: { status: to, note } },
      },
    });
    this.events.emit(ORDER_STATUS_CHANGED_EVENT, { orderId, from, to } satisfies OrderStatusChangedEvent);
  }
}
