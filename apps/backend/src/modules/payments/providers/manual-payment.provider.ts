import { Injectable } from '@nestjs/common';
import { AuthorizeResult, PaymentProvider, RefundResult } from '../payment-provider.interface';

// Net Profit Manual Payment (CLAUDE.net-profit.md §7.12) — bKash/Nagad/
// Rocket "pay to a merchant number, submit the transaction ID" flow,
// implemented as a manual PaymentProvider rather than a new payment layer
// per the spec's own instruction. Same shape as COD's provider: nothing to
// call synchronously, the real settlement happens later (staff verifies the
// submitted `ManualPayment` row via `/admin/net-profit/payments/manual`).
@Injectable()
export class ManualPaymentProvider implements PaymentProvider {
  async authorize(): Promise<AuthorizeResult> {
    await Promise.resolve();
    return { status: 'PENDING' };
  }

  async refund(): Promise<RefundResult> {
    // Manual refund outside the system (same as COD) — admin sends money
    // back via the same mobile wallet and records the outcome here.
    await Promise.resolve();
    return { status: 'REFUNDED' };
  }
}
