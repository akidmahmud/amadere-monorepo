import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { SalesPostingService } from '../../net-profit/accounts/ledger/sales-posting.service';
import { DownloadsService } from '../../digital-products/downloads.service';
import { OrderEmailsService } from '../../order-emails/order-emails.service';
import { ORDER_STATUS_CHANGED_EVENT } from '../../orders/orders.events';
import type { OrderStatusChangedEvent } from '../../orders/orders.events';
import { BkashPaymentProvider } from './bkash-payment.provider';

export interface SettleOutcome {
  ok: boolean;
  orderNumber?: string;
}

// The capture half of the bKash flow. Mirrors what ManualPaymentService.verify
// does when staff approve a submission — Payment PENDING -> CAPTURED, post the
// prepaid capture to the ledger, move the order forward, release any digital
// files — except the approval here comes from bKash's execute call instead of
// an admin. Kept as its own service rather than folded into verify(), which is
// built around a ManualPayment row this flow never creates.
@Injectable()
export class BkashCallbackService {
  private readonly logger = new Logger(BkashCallbackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: BkashPaymentProvider,
    private readonly salesPosting: SalesPostingService,
    private readonly downloads: DownloadsService,
    private readonly orderEmails: OrderEmailsService,
    private readonly events: EventEmitter2,
  ) {}

  async settle(
    paymentID: string | undefined,
    status: string | undefined,
  ): Promise<SettleOutcome> {
    if (!paymentID) return { ok: false };

    // transactionRef was set to bKash's paymentID by the provider's
    // authorize(), which is the only handle the callback carries.
    const payment = await this.prisma.client.payment.findFirst({
      where: { provider: 'BKASH', transactionRef: paymentID },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) {
      this.logger.warn(`bKash callback for unknown paymentID ${paymentID}`);
      return { ok: false };
    }
    const order = await this.prisma.client.order.findUnique({
      where: { id: payment.orderId },
    });
    const orderNumber = order?.orderNumber;

    // The customer backed out on bKash's page, or bKash itself reported a
    // failure. Nothing was charged.
    if (status !== 'success') {
      await this.markFailed(payment.id, payment.status);
      return { ok: false, orderNumber };
    }

    // Already settled — bKash can call back more than once, and a customer
    // refreshing the return URL hits this too. Report the existing outcome
    // instead of executing (and capturing) a second time.
    if (payment.status === 'CAPTURED') return { ok: true, orderNumber };

    const result = await this.provider.executePayment(paymentID);
    if (result.statusCode !== '0000' || !result.trxID) {
      this.logger.warn(
        `bKash execute rejected paymentID=${paymentID}: ${result.statusMessage ?? 'no statusMessage'}`,
      );
      await this.markFailed(payment.id, payment.status);
      return { ok: false, orderNumber };
    }

    await this.prisma.client.payment.update({
      where: { id: payment.id },
      data: {
        status: 'CAPTURED',
        transactionRef: result.trxID,
        rawResponse: result as object,
      },
    });

    // Best-effort from here down, in the same spirit as
    // ManualPaymentService.verify: the customer's money has already moved, so
    // a bookkeeping or email problem must not surface as a failed payment.
    try {
      await this.salesPosting.postPrepaidCapture({
        orderId: payment.orderId,
        amount: payment.amount,
        capturedAt: new Date(),
        reference: result.trxID,
      });
    } catch (err) {
      this.logger.error(
        `bKash ledger posting failed for order ${payment.orderId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    await this.advanceOrder(payment.orderId, order?.status);

    // BEFORE the order email below, deliberately: the email's `download_links`
    // are built from the rows this unlocks, so sending first would mail a
    // digital buyer an order confirmation with no download button on it.
    try {
      await this.downloads.unlockForOrder(payment.orderId);
    } catch (err) {
      this.logger.error(
        `bKash digital unlock failed for order ${payment.orderId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Deferred from checkout: for a hosted gateway the "we've received your
    // order" mail must wait until the money actually moved, otherwise a
    // customer who cancels on bKash still gets told their order is in.
    try {
      await this.orderEmails.sendOrderPlaced(payment.orderId);
      await this.orderEmails.sendNewOrderAdminNotice(payment.orderId);
    } catch (err) {
      this.logger.error(
        `bKash order emails failed for order ${payment.orderId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return { ok: true, orderNumber };
  }

  // Only a still-PENDING payment can fail — never downgrade one that has
  // already captured (a duplicate callback, or an admin who settled it by
  // hand in the meantime).
  private async markFailed(paymentId: number, currentStatus: string): Promise<void> {
    if (currentStatus !== 'PENDING') return;
    await this.prisma.client.payment.update({
      where: { id: paymentId },
      data: { status: 'FAILED' },
    });
  }

  // Same per-method "order status after payment" setting the manual flow
  // honours, read from PaymentMethodConfig[BKASH]. Only moves an order
  // forward from PENDING/HOLD, never over a status staff already progressed.
  private async advanceOrder(
    orderId: number,
    currentStatus: string | undefined,
  ): Promise<void> {
    if (currentStatus !== 'PENDING' && currentStatus !== 'HOLD') return;
    const config = await this.prisma.client.paymentMethodConfig.findUnique({
      where: { provider: 'BKASH' },
    });
    const next = config?.orderStatusAfterVerify ?? 'CONFIRMED';
    await this.prisma.client.order.update({
      where: { id: orderId },
      data: {
        status: next,
        statusHistory: { create: { status: next, note: 'bKash payment captured' } },
      },
    });
    this.events.emit(ORDER_STATUS_CHANGED_EVENT, {
      orderId,
      from: currentStatus,
      to: next,
    } satisfies OrderStatusChangedEvent);
  }
}
