import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginationArgs,
  toPaginatedResult,
} from '../../common/pagination.util';
import { PaymentsService } from '../payments/payments.service';
import { ORDER_INCLUDE, toOrderDto } from './orders.mapper';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
import { TrackOrderDto } from './dto/track-order.dto';
import {
  ORDER_STATUS_CHANGED_EVENT,
  OrderStatusChangedEvent,
} from './orders.events';

// Statuses that release/commit the stock reservation held at checkout.
const RELEASE_ON_CANCEL = new Set(['CANCELED']);
const COMMIT_ON_COMPLETE = new Set(['COMPLETED']);

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly events: EventEmitter2,
  ) {}

  async adminList(page: number, pageSize: number, status?: string) {
    const where = status ? { status: status as never } : {};
    const [items, total] = await Promise.all([
      this.prisma.client.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.order.count({ where }),
    ]);
    return toPaginatedResult(items.map(toOrderDto), total, page, pageSize);
  }

  async adminGet(id: number) {
    const order = await this.prisma.client.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Order not found');
    return toOrderDto(order);
  }

  async updateStatus(
    id: number,
    dto: UpdateOrderStatusDto,
    adminUserId: number,
  ) {
    const order = await this.prisma.client.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === dto.status) return this.reload(id);

    await this.prisma.client.$transaction(async (tx) => {
      if (RELEASE_ON_CANCEL.has(dto.status)) {
        await this.releaseReservations(tx, order.items);
      }
      if (COMMIT_ON_COMPLETE.has(dto.status)) {
        await this.commitReservations(tx, order.items);
      }

      await tx.order.update({
        where: { id },
        data: {
          status: dto.status,
          confirmedAt: dto.status === 'PROCESSING' ? new Date() : undefined,
          completedAt: dto.status === 'COMPLETED' ? new Date() : undefined,
          canceledAt: dto.status === 'CANCELED' ? new Date() : undefined,
        },
      });
      await tx.orderStatusHistory.create({
        data: { orderId: id, status: dto.status, note: dto.note, adminUserId },
      });
    });

    this.events.emit(ORDER_STATUS_CHANGED_EVENT, {
      orderId: id,
      from: order.status,
      to: dto.status,
    } satisfies OrderStatusChangedEvent);

    return this.reload(id);
  }

  async refund(id: number, dto: RefundOrderDto, adminUserId: number) {
    const order = await this.prisma.client.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (dto.amount > Number(order.totalAmount)) {
      throw new BadRequestException('Refund amount exceeds order total');
    }

    await this.payments.refund(id, new Prisma.Decimal(dto.amount));
    await this.prisma.client.orderStatusHistory.create({
      data: {
        orderId: id,
        status: order.status,
        note: dto.reason
          ? `Refunded ${dto.amount}: ${dto.reason}`
          : `Refunded ${dto.amount}`,
        adminUserId,
      },
    });
    return this.reload(id);
  }

  async myList(customerId: number, page: number, pageSize: number) {
    const where = { customerId };
    const [items, total] = await Promise.all([
      this.prisma.client.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.order.count({ where }),
    ]);
    return toPaginatedResult(items.map(toOrderDto), total, page, pageSize);
  }

  async myGet(customerId: number, orderNumber: string) {
    const order = await this.prisma.client.order.findUnique({
      where: { orderNumber },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId !== customerId)
      throw new ForbiddenException('This order does not belong to you');
    return toOrderDto(order);
  }

  // Guest tracking: orderNumber + shipping phone, no account required.
  async track(dto: TrackOrderDto) {
    const order = await this.prisma.client.order.findUnique({
      where: { orderNumber: dto.orderNumber },
      include: { ...ORDER_INCLUDE, addresses: true },
    });
    if (!order || !order.addresses.some((a) => a.phone === dto.phone)) {
      throw new NotFoundException('Order not found');
    }
    return toOrderDto(order);
  }

  private async reload(id: number) {
    const order = await this.prisma.client.order.findUniqueOrThrow({
      where: { id },
      include: ORDER_INCLUDE,
    });
    return toOrderDto(order);
  }

  private async releaseReservations(
    tx: Prisma.TransactionClient,
    items: {
      productId: number | null;
      variantId: number | null;
      quantity: number;
    }[],
  ): Promise<void> {
    for (const item of items) {
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { reservedStock: { decrement: item.quantity } },
        });
      } else if (item.productId) {
        await tx.product.update({
          where: { id: item.productId },
          data: { reservedStock: { decrement: item.quantity } },
        });
      }
    }
  }

  private async commitReservations(
    tx: Prisma.TransactionClient,
    items: {
      productId: number | null;
      variantId: number | null;
      quantity: number;
    }[],
  ): Promise<void> {
    for (const item of items) {
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            reservedStock: { decrement: item.quantity },
            stock: { decrement: item.quantity },
          },
        });
      } else if (item.productId) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            reservedStock: { decrement: item.quantity },
            stock: { decrement: item.quantity },
          },
        });
      }
    }
  }
}
