import { Injectable } from '@nestjs/common';
import {
  AuthorizeResult,
  PaymentProvider,
  RefundResult,
} from '../payment-provider.interface';

// Cash on Delivery: nothing to authorize online — the courier collects cash
// on delivery, so this just records a PENDING payment that admin marks
// CAPTURED when the order is confirmed delivered (B7 courier integration).
@Injectable()
export class CodPaymentProvider implements PaymentProvider {
  async authorize(): Promise<AuthorizeResult> {
    await Promise.resolve();
    return { status: 'PENDING' };
  }

  async refund(): Promise<RefundResult> {
    // COD refunds are manual (bank transfer/mobile wallet outside the
    // system) — admin records the outcome, there's nothing to call.
    await Promise.resolve();
    return { status: 'REFUNDED' };
  }
}
