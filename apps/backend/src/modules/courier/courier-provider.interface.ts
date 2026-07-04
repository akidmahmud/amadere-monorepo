import { Prisma } from '@amader/db';

export const COURIER_PROVIDER_REGISTRY = Symbol('COURIER_PROVIDER_REGISTRY');

export interface CreateConsignmentInput {
  invoiceNumber: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  codAmount: Prisma.Decimal;
  weightKg?: Prisma.Decimal;
  note?: string;
  itemDescription?: string;
}

export interface CreateConsignmentResult {
  success: boolean;
  consignmentId?: string;
  trackingCode?: string;
  rawStatus?: string;
  errorMessage?: string;
  requestPayload: unknown;
  rawResponse: unknown;
}

export interface TrackResult {
  rawStatus: string;
  rawResponse: unknown;
}

export interface CancelReturnResult {
  success: boolean;
  note?: string;
  rawResponse: unknown;
}

// One interface, one implementation per courier — Steadfast is real
// (proven against the reference codebase's working integration); Pathao/
// RedX/eCourier plug in behind it the same way once credentials arrive
// (AGENTS.md §6, same deferred-provider pattern as Payment).
export interface CourierProvider {
  createConsignment(
    input: CreateConsignmentInput,
  ): Promise<CreateConsignmentResult>;
  track(consignmentId: string): Promise<TrackResult>;
  cancelOrReturn(
    consignmentId: string,
    reasonCode: string,
  ): Promise<CancelReturnResult>;
}
