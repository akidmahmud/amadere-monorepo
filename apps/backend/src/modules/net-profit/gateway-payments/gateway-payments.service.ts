import { Injectable } from '@nestjs/common';
import { PaymentProvider, PaymentStatus, Prisma } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { paginationArgs, toPaginatedResult } from '../../../common/pagination.util';
import { GatewayPaymentDto, toGatewayPaymentDto } from './gateway-payments.mapper';

/**
 * Read-only view of gateway payments — the `Payment` rows a provider captured
 * on its own, with no admin in the loop.
 *
 * Why this exists: nothing in the admin listed `Payment` at all
 * (`payment.findMany` appeared nowhere in the codebase). Net Profit >
 * Payments showed only ManualPayment submissions and advance payments, and
 * BkashCallbackService says so in its own comment — it is "built around a
 * ManualPayment row this flow never creates". So a customer paying through
 * the bKash gateway had their order marked paid and confirmed correctly, and
 * there was no screen anywhere showing that money had arrived or what its
 * transaction id was.
 *
 * Deliberately has no verify/reject: these are already CAPTURED by the
 * provider. Approving them would be theatre. It exists to be reconciled
 * against a bKash/Nagad merchant statement, which is why transactionRef is
 * the one field that matters most here.
 */
@Injectable()
export class GatewayPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    page: number,
    pageSize: number,
    filters: {
      provider?: PaymentProvider;
      status?: PaymentStatus;
      /** Matches a transaction ref or an order number, case-insensitively. */
      q?: string;
    } = {},
  ): Promise<PaginatedResult<GatewayPaymentDto>> {
    const q = filters.q?.trim();
    const where: Prisma.PaymentWhereInput = {
      ...(filters.provider ? { provider: filters.provider } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      // COD is not a payment anyone reconciles here — the money arrives from
      // the courier settlement, which has its own screen.
      ...(filters.provider ? {} : { provider: { not: 'COD' as PaymentProvider } }),
      ...(q
        ? {
            OR: [
              { transactionRef: { contains: q, mode: 'insensitive' as const } },
              { order: { orderNumber: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [items, total, captured] = await Promise.all([
      this.prisma.client.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { order: { select: { orderNumber: true, status: true } } },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.payment.count({ where }),
      // The number staff actually came here for: how much money this filter
      // represents. Summed over CAPTURED only — a PENDING row is an intent,
      // not cash.
      this.prisma.client.payment.aggregate({
        where: { ...where, status: 'CAPTURED' },
        _sum: { amount: true },
      }),
    ]);

    return {
      ...toPaginatedResult(items.map(toGatewayPaymentDto), total, page, pageSize),
      capturedTotal: (captured._sum.amount ?? new Prisma.Decimal(0)).toString(),
    } as PaginatedResult<GatewayPaymentDto> & { capturedTotal: string };
  }
}
