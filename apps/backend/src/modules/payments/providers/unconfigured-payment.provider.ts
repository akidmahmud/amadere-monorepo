import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PaymentProvider } from '../payment-provider.interface';

// Shared stub for bKash/Nagad/SSLCommerz/Bank Transfer until each gateway's
// credentials arrive — same deferred-provider pattern as Media/SocialLogin.
@Injectable()
export class UnconfiguredPaymentProvider implements PaymentProvider {
  constructor(private readonly gatewayName: string) {}

  async authorize(): Promise<never> {
    await Promise.resolve();
    throw new ServiceUnavailableException(
      `${this.gatewayName} is not configured yet`,
    );
  }

  async refund(): Promise<never> {
    await Promise.resolve();
    throw new ServiceUnavailableException(
      `${this.gatewayName} is not configured yet`,
    );
  }
}
