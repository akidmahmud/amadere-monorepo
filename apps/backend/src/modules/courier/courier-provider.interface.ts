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
  // Pathao/RedX both require a location selection at consignment-create
  // time (Pathao: store + city/zone/area; RedX: delivery area + pickup
  // store) that has no equivalent on Steadfast — optional here so the
  // shared interface stays simple for the provider that doesn't need them.
  pathao?: { storeId: number; recipientCity?: number; recipientZone?: number; recipientArea?: number };
  redx?: { deliveryAreaId: number; pickupStoreId?: number };
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

export interface FraudCheckResult {
  total: number;
  delivered: number;
  cancelled: number;
}

export type FraudCheckOutcome =
  | ({ unavailable?: false } & FraudCheckResult)
  | { unavailable: true };

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
  // Net Profit fraud detection (CLAUDE.net-profit.md §7.2): per-courier
  // delivered/cancelled history for a phone. Optional — a courier without a
  // fraud-check endpoint simply omits this method; callers must check for
  // its presence and never assume every provider implements it.
  fraudCheck?(phoneMsisdn: string): Promise<FraudCheckOutcome>;
}
