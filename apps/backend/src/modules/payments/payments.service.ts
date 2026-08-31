import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PaymentProvider as PaymentProviderEnum } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SalesPostingService } from '../net-profit/accounts/ledger/sales-posting.service';
import { PaymentProvider } from './payment-provider.interface';
import { CodPaymentProvider } from './providers/cod-payment.provider';
import { UnconfiguredPaymentProvider } from './providers/unconfigured-payment.provider';
import { ManualPaymentProvider } from './providers/manual-payment.provider';
import { BkashPaymentProvider } from './bkash/bkash-payment.provider';
import { BkashSettingsService } from './bkash/bkash-settings.service';

@Injectable()
export class PaymentsService {
  private readonly providers: Record<PaymentProviderEnum, PaymentProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly salesPosting: SalesPostingService,
    cod: CodPaymentProvider,
    manual: ManualPaymentProvider,
    private readonly bkash: BkashPaymentProvider,
    private readonly bkashSettings: BkashSettingsService,
  ) {
    this.providers = {
      COD: cod,
      // bKash/Nagad/Rocket/Upay route to the real Net Profit manual-payment
      // flow (customer pays to a merchant number, submits the trx id, staff
      // verifies) rather than an unconfigured-gateway stub — this *is* the
      // real Phase-1 implementation for these four now, not a placeholder;
      // a true online-gateway integration is a separate future upgrade.
      BKASH: manual,
      NAGAD: manual,
      ROCKET: manual,
      UPAY: manual,
      SSLCOMMERZ: new UnconfiguredPaymentProvider('SSLCommerz'),
      BANK_TRANSFER: new UnconfiguredPaymentProvider('Bank Transfer'),
    };
  }

  // Async because BKASH's answer lives in the database: the tokenized
  // gateway when it is switched on AND all four credentials are stored,
  // otherwise the manual pay-to-a-merchant-number flow. A half-configured
  // gateway must never be chosen — a customer would hit a dead redirect
  // mid-checkout instead of simply seeing the manual instructions.
  async resolve(provider: PaymentProviderEnum): Promise<PaymentProvider> {
    if (provider === 'BKASH' && (await this.bkashSettings.isGatewayLive())) {
      return this.bkash;
    }
    return this.providers[provider];
  }

  async refund(orderId: number, amount: Prisma.Decimal) {
    const payment = await this.prisma.client.payment.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment)
      throw new NotFoundException('No payment found for this order');

    const result = await (await this.resolve(payment.provider)).refund(
      payment.transactionRef,
      amount,
    );
    const updated = await this.prisma.client.payment.update({
      where: { id: payment.id },
      data: {
        status: result.status,
        refundedAmount: amount,
        rawResponse: (result.rawResponse as object) ?? undefined,
      },
    });

    // Money leaving the business. Best-effort: a ledger problem must not make
    // a refund appear to have failed when the customer has been paid.
    await this.salesPosting.postRefund({
      orderId,
      amount,
      refundedAt: new Date(),
    });

    return updated;
  }
}
