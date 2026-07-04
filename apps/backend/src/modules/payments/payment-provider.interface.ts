import { Prisma } from '@amader/db';

export interface AuthorizeResult {
  // Set immediately for providers that settle synchronously (COD); left
  // PENDING for gateways where a webhook/redirect completes it later.
  status: 'PENDING' | 'AUTHORIZED' | 'CAPTURED';
  transactionRef?: string;
  redirectUrl?: string;
  rawResponse?: unknown;
}

export interface RefundResult {
  status: 'REFUNDED' | 'PARTIALLY_REFUNDED';
  rawResponse?: unknown;
}

// One interface, one implementation per gateway — COD works today; bKash/
// Nagad/SSLCommerz/Bank Transfer are stubs until credentials arrive
// (AGENTS.md §6 "do not block Phase 1 on payment credentials").
export interface PaymentProvider {
  authorize(orderId: number, amount: Prisma.Decimal): Promise<AuthorizeResult>;
  refund(
    transactionRef: string | null,
    amount: Prisma.Decimal,
  ): Promise<RefundResult>;
}
