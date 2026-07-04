import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PaymentProvider as PaymentProviderEnum } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaymentProvider } from './payment-provider.interface';
import { CodPaymentProvider } from './providers/cod-payment.provider';
import { UnconfiguredPaymentProvider } from './providers/unconfigured-payment.provider';

@Injectable()
export class PaymentsService {
  private readonly providers: Record<PaymentProviderEnum, PaymentProvider>;

  constructor(
    private readonly prisma: PrismaService,
    cod: CodPaymentProvider,
  ) {
    this.providers = {
      COD: cod,
      BKASH: new UnconfiguredPaymentProvider('bKash'),
      NAGAD: new UnconfiguredPaymentProvider('Nagad'),
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
