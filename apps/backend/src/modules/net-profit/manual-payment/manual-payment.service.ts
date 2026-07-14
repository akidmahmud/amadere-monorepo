import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ManualPayStatus, Prisma } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { paginationArgs, toPaginatedResult } from '../../../common/pagination.util';
import { AdvancePaymentService } from '../advance-payment/advance-payment.service';
import { SubmitManualPaymentDto } from './dto/submit-manual-payment.dto';
import { ManualPaymentDto, toManualPaymentDto } from './manual-payment.mapper';

@Injectable()
export class ManualPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly advancePayment: AdvancePaymentService,
  ) {}

  async submit(dto: SubmitManualPaymentDto): Promise<ManualPaymentDto> {
    const order = await this.prisma.client.order.findUnique({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException('Order not found');

    try {
      const row = await this.prisma.client.manualPayment.create({
        data: {
          orderId: dto.orderId,
          method: dto.method,
          senderMsisdn: dto.senderMsisdn,
          trxId: dto.trxId,
          amount: new Prisma.Decimal(dto.amount),
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

  async list(page: number, pageSize: number, status?: ManualPayStatus): Promise<PaginatedResult<ManualPaymentDto>> {
    const where = status ? { status } : {};
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
