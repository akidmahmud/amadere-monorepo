import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PaymentProvider as PaymentProviderEnum } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaymentProvider } from './payment-provider.interface';
import { CodPaymentProvider } from './providers/cod-payment.provider';
import { UnconfiguredPaymentProvider } from './providers/unconfigured-payment.provider';
import { ManualPaymentProvider } from './providers/manual-payment.provider';

@Injectable()
export class PaymentsService {
  private readonly providers: Record<PaymentProviderEnum, PaymentProvider>;

  constructor(
    private readonly prisma: PrismaService,
    cod: CodPaymentProvider,
    manual: ManualPaymentProvider,
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

  resolve(provider: PaymentProviderEnum): PaymentProvider {
    return this.providers[provider];
  }

  async refund(orderId: number, amount: Prisma.Decimal) {
    const payment = await this.prisma.client.payment.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment)
      throw new NotFoundException('No payment found for this order');

    const result = await this.providers[payment.provider].refund(
      payment.transactionRef,
      amount,
    );
    return this.prisma.client.payment.update({
      where: { id: payment.id },
      data: {
        status: result.status,
        refundedAmount: amount,
        rawResponse: (result.rawResponse as object) ?? undefined,
      },
    });
  }
}
