import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CourierProvider } from '../courier-provider.interface';

// Shared stub for Pathao/RedX/eCourier until each one's credentials arrive —
// same deferred-provider pattern as Payment (bKash/Nagad/SSLCommerz).
@Injectable()
export class UnconfiguredCourierProvider implements CourierProvider {
  constructor(private readonly courierName: string) {}

  async createConsignment(): Promise<never> {
    await Promise.resolve();
    throw new ServiceUnavailableException(
      `${this.courierName} is not configured yet`,
    );
  }

  async track(): Promise<never> {
    await Promise.resolve();
    throw new ServiceUnavailableException(
      `${this.courierName} is not configured yet`,
    );
  }

  async cancelOrReturn(): Promise<never> {
    await Promise.resolve();
    throw new ServiceUnavailableException(
      `${this.courierName} is not configured yet`,
    );
  }
}
