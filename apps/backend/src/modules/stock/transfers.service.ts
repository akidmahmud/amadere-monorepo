import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Locale, Prisma, TransferStatus } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StockService } from './stock.service';
import { docNumber } from './stock-docs.service';
import { assertStoreActive } from '../stores/store-scope';
import type { CreateTransferDto } from './dto/transfer.dto';

export const TRANSITIONS: Record<TransferStatus, TransferStatus[]> = {
  REQUESTED: ['APPROVED', 'CANCELLED'],
  APPROVED: ['DISPATCHED', 'CANCELLED'],
  // Goods on the road can only arrive; a shortfall is recorded at receive.
  // In transit: arrives, or is called back (stock returns to the source).
  DISPATCHED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: [],
  CANCELLED: [],
};

export function assertTransition(
  from: TransferStatus,
  to: TransferStatus,
): void {
  if (!TRANSITIONS[from].includes(to))
    throw new BadRequestException(`Cannot move a ${from} transfer to ${to}`);
}

/**
 * Moves the status only if it is still `from`, so of two concurrent clicks
 * exactly one wins; the loser throws before any stock moves.
 */
async function claim(
  tx: Prisma.TransactionClient,
  id: number,
  from: TransferStatus,
  data: Prisma.StockTransferUpdateManyMutationInput,
): Promise<void> {
  const { count } = await tx.stockTransfer.updateMany({
    where: { id, status: from },
    data,
  });
  if (count !== 1)
    throw new ConflictException(
      'This transfer was already updated — refresh the list',
    );
}

/** `scope` null = all-stores user, allowed to act for either side. */
function assertSide(scope: number | null, storeId: number): void {
  if (scope !== null && scope !== storeId)
    throw new ForbiddenException('This step belongs to the other store');
}

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  async list(scope: number | null) {
    const transfers = await this.prisma.client.stockTransfer.findMany({
      where: scope
        ? { OR: [{ fromStoreId: scope }, { toStoreId: scope }] }
        : {},
      include: {
        items: true,
        fromStore: { select: { name: true } },
        toStore: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    // Lines store ids only; attach names for display.
    const ids = [
      ...new Set(transfers.flatMap((t) => t.items.map((i) => i.productId))),
    ];
    const products = await this.prisma.client.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        slug: true,
        translations: {
          where: { locale: Locale.EN },
          take: 1,
          select: { name: true },
        },
      },
    });
    const name = new Map(
      products.map((p) => [p.id, p.translations[0]?.name ?? p.slug]),
    );
    return transfers.map((t) => ({
      ...t,
      items: t.items.map((i) => ({
        ...i,
        name: name.get(i.productId) ?? `#${i.productId}`,
      })),
    }));
  }

  async create(fromStoreId: number, dto: CreateTransferDto, adminId: number) {
    if (fromStoreId === dto.toStoreId)
      throw new BadRequestException(
        'Source and destination are the same store',
      );
    return this.prisma.client.$transaction(async (tx) => {
      const from = await tx.store.findUniqueOrThrow({
        where: { id: fromStoreId },
      });
      assertStoreActive(from);
      assertStoreActive(
        await tx.store.findUniqueOrThrow({ where: { id: dto.toStoreId } }),
      );
      // A store-only product belongs to one store; moving it would strand the
      // transfer at receive time, so it is refused up front.
      const storeOnly = await tx.product.findMany({
        where: {
          id: { in: dto.items.map((l) => l.productId) },
          storeId: { not: null },
        },
        select: { id: true },
      });
      if (storeOnly.length) {
        throw new BadRequestException(
          `Product #${storeOnly[0].id} is only sold at one store and can't be transferred`,
        );
      }
      const t = await tx.stockTransfer.create({
        data: {
          number: `tmp-${Date.now()}-${Math.random()}`,
          fromStoreId,
          toStoreId: dto.toStoreId,
          note: dto.note,
          requestedById: adminId,
          items: {
            create: dto.items.map((i) => ({
              productId: i.productId,
              variantId: i.variantId ?? null,
              qty: i.qty,
            })),
          },
        },
      });
      return tx.stockTransfer.update({
        where: { id: t.id },
        data: { number: docNumber('TRF', from.code, t.id) },
      });
    });
  }

  /** `scope` null = all-stores user; otherwise the approver must be at one of the two stores. */
  approve(scope: number | null, id: number, adminId: number) {
    return this.prisma.client.$transaction(async (tx) => {
      const t = await tx.stockTransfer.findUniqueOrThrow({ where: { id } });
      if (scope !== null && scope !== t.fromStoreId && scope !== t.toStoreId) {
        throw new ForbiddenException('This transfer belongs to other stores');
      }
      assertTransition(t.status, 'APPROVED');
      await claim(tx, id, t.status, {
        status: 'APPROVED',
        approvedById: adminId,
        approvedAt: new Date(),
      });
      return tx.stockTransfer.findUniqueOrThrow({ where: { id } });
    });
  }

  dispatch(scope: number | null, id: number, adminId: number) {
    return this.prisma.client.$transaction(async (tx) => {
      const t = await tx.stockTransfer.findUniqueOrThrow({
        where: { id },
        include: { items: true },
      });
      assertSide(scope, t.fromStoreId);
      assertTransition(t.status, 'DISPATCHED');
      await claim(tx, id, t.status, {
        status: 'DISPATCHED',
        dispatchedById: adminId,
        dispatchedAt: new Date(),
      });
      for (const i of t.items) {
        await this.stock.move(tx, {
          storeId: t.fromStoreId,
          productId: i.productId,
          variantId: i.variantId,
          type: 'TRANSFER_OUT',
          qty: -i.qty,
          transferId: id,
          adminUserId: adminId,
        });
      }
      return tx.stockTransfer.findUniqueOrThrow({ where: { id } });
    });
  }

  receive(
    scope: number | null,
    id: number,
    received: { id: number; receivedQty: number }[],
    adminId: number,
  ) {
    return this.prisma.client.$transaction(async (tx) => {
      const t = await tx.stockTransfer.findUniqueOrThrow({
        where: { id },
        include: { items: true },
      });
      assertSide(scope, t.toStoreId);
      assertTransition(t.status, 'RECEIVED');
      assertStoreActive(
        await tx.store.findUniqueOrThrow({ where: { id: t.toStoreId } }),
      );
      const got = new Map(received.map((r) => [r.id, r.receivedQty]));
      for (const i of t.items) {
        if ((got.get(i.id) ?? i.qty) > i.qty)
          throw new BadRequestException(
            `Received more than was sent for line #${i.id}`,
          );
      }
      await claim(tx, id, t.status, {
        status: 'RECEIVED',
        receivedById: adminId,
        receivedAt: new Date(),
      });
      for (const i of t.items) {
        const qty = got.get(i.id) ?? i.qty;
        await tx.stockTransferItem.update({
          where: { id: i.id },
          data: { receivedQty: qty },
        });
        // A shortfall is recorded on the line, not re-credited to the source.
        await this.stock.move(tx, {
          storeId: t.toStoreId,
          productId: i.productId,
          variantId: i.variantId,
          type: 'TRANSFER_IN',
          qty,
          transferId: id,
          adminUserId: adminId,
        });
      }
      return tx.stockTransfer.findUniqueOrThrow({ where: { id } });
    });
  }

  cancel(scope: number | null, id: number, adminId: number | null = null) {
    return this.prisma.client.$transaction(async (tx) => {
      const t = await tx.stockTransfer.findUniqueOrThrow({
        where: { id },
        include: { items: true },
      });
      if (scope !== null && scope !== t.fromStoreId && scope !== t.toStoreId) {
        throw new ForbiddenException('Not your transfer');
      }
      assertTransition(t.status, 'CANCELLED');
      await claim(tx, id, t.status, { status: 'CANCELLED' });
      // Already dispatched: the goods come back to where they left.
      if (t.status === 'DISPATCHED') {
        for (const i of t.items) {
          await this.stock.move(tx, {
            storeId: t.fromStoreId,
            productId: i.productId,
            variantId: i.variantId,
            type: 'TRANSFER_IN',
            qty: i.qty,
            transferId: id,
            reason: 'Transfer cancelled in transit',
            adminUserId: adminId,
          });
        }
      }
      return tx.stockTransfer.findUniqueOrThrow({ where: { id } });
    });
  }
}
