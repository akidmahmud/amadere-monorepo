import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ManualPayStatus, PaymentProvider, Prisma } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { paginationArgs, toPaginatedResult } from '../../../common/pagination.util';
import { ORDER_STATUS_CHANGED_EVENT } from '../../orders/orders.events';
import type { OrderStatusChangedEvent } from '../../orders/orders.events';
import { AdvancePaymentService } from '../advance-payment/advance-payment.service';
import { SubmitManualPaymentDto, TRX_ID_PATTERNS } from './dto/submit-manual-payment.dto';
import { ManualPaymentDto, toManualPaymentDto } from './manual-payment.mapper';

const METHOD_TO_PROVIDER: Record<string, PaymentProvider> = {
  bkash: 'BKASH',
  nagad: 'NAGAD',
  rocket: 'ROCKET',
  upay: 'UPAY',
};

@Injectable()
export class ManualPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly advancePayment: AdvancePaymentService,
    private readonly events: EventEmitter2,
  ) {}

  async submit(dto: SubmitManualPaymentDto): Promise<ManualPaymentDto> {
    const order = await this.prisma.client.order.findUnique({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const pattern = TRX_ID_PATTERNS[dto.method];
    const normalizedTrxId = dto.trxId.trim().toUpperCase();
    if (!pattern.regex.test(normalizedTrxId)) {
      throw new BadRequestException(`Please enter ${pattern.hint}.`);
    }

    try {
      const row = await this.prisma.client.manualPayment.create({
        data: {
          orderId: dto.orderId,
          method: dto.method,
          senderMsisdn: dto.senderMsisdn,
          trxId: normalizedTrxId,
          amount: new Prisma.Decimal(dto.amount),
          screenshotUrl: dto.screenshotUrl,
        },
      });
      return toManualPaymentDto(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('This transaction ID has already been submitted');
      }
      throw err;
    }
  }

  async list(page: number, pageSize: number, status?: ManualPayStatus, orderId?: number): Promise<PaginatedResult<ManualPaymentDto>> {
    const where = { ...(status ? { status } : {}), ...(orderId ? { orderId } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.client.manualPayment.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginationArgs(page, pageSize) }),
      this.prisma.client.manualPayment.count({ where }),
    ]);
    return toPaginatedResult(items.map(toManualPaymentDto), total, page, pageSize);
  }

  // Marks the order/advance paid (DoD): the underlying Payment row created
  // at checkout goes PENDING -> CAPTURED, and if the order also has an
  // AdvancePayment outstanding, that gets credited too.
  async verify(id: number, adminUserId: number): Promise<ManualPaymentDto> {
    const submission = await this.prisma.client.manualPayment.findUnique({ where: { id } });
    if (!submission) throw new NotFoundException('Manual payment not found');
    if (submission.status !== 'SUBMITTED') throw new ConflictException('This submission has already been reviewed');

    const row = await this.prisma.client.manualPayment.update({
      where: { id },
      data: { status: 'VERIFIED', verifiedBy: adminUserId },
    });

    const payment = await this.prisma.client.payment.findFirst({
      where: { orderId: submission.orderId },
      orderBy: { createdAt: 'desc' },
    });
    if (payment && payment.status === 'PENDING') {
      await this.prisma.client.payment.update({
        where: { id: payment.id },
        data: { status: 'CAPTURED', transactionRef: submission.trxId },
      });
    }

    const advance = await this.advancePayment.get(submission.orderId);
    if (advance && advance.status !== 'PAID' && advance.status !== 'WAIVED') {
      await this.advancePayment.record(submission.orderId, submission.amount);
    }

    // Per-method configurable status-after-verify (Payments parity — the
    // plugin's per-gateway "order status after payment" setting). Only
    // moves the order forward from PENDING/HOLD — never downgrades a status
    // staff has already progressed manually in the meantime.
    const provider = METHOD_TO_PROVIDER[submission.method];
    const config = provider
      ? await this.prisma.client.paymentMethodConfig.findUnique({ where: { provider } })
      : null;
    if (config) {
      const order = await this.prisma.client.order.findUnique({ where: { id: submission.orderId } });
      if (order && (order.status === 'PENDING' || order.status === 'HOLD')) {
        await this.prisma.client.order.update({
          where: { id: submission.orderId },
          data: {
            status: config.orderStatusAfterVerify,
            statusHistory: { create: { status: config.orderStatusAfterVerify, note: 'Manual payment verified' } },
          },
        });
        this.events.emit(ORDER_STATUS_CHANGED_EVENT, {
          orderId: submission.orderId,
          from: order.status,
          to: config.orderStatusAfterVerify,
        } satisfies OrderStatusChangedEvent);
      }
    }

    return toManualPaymentDto(row);
  }

  async reject(id: number, adminUserId: number): Promise<ManualPaymentDto> {
    const submission = await this.prisma.client.manualPayment.findUnique({ where: { id } });
    if (!submission) throw new NotFoundException('Manual payment not found');
    if (submission.status !== 'SUBMITTED') throw new ConflictException('This submission has already been reviewed');

    const row = await this.prisma.client.manualPayment.update({
      where: { id },
      data: { status: 'REJECTED', verifiedBy: adminUserId },
    });
    return toManualPaymentDto(row);
  }
}
