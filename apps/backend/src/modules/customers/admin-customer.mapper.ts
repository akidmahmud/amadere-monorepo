import { Prisma } from '@amader/db';
import { ApiProperty } from '@nestjs/swagger';

export const ADMIN_CUSTOMER_LIST_INCLUDE = {
  tier: true,
} as const;

export type CustomerWithTier = Prisma.CustomerGetPayload<{
  include: typeof ADMIN_CUSTOMER_LIST_INCLUDE;
}>;

export const ADMIN_CUSTOMER_DETAIL_INCLUDE = {
  tier: true,
  notes: { orderBy: { createdAt: 'desc' as const } },
  callLogs: { orderBy: { createdAt: 'desc' as const } },
  orders: {
    orderBy: { createdAt: 'desc' as const },
    include: { statusHistory: { orderBy: { createdAt: 'asc' as const } } },
  },
} as const;

export type CustomerWithDetail = Prisma.CustomerGetPayload<{
  include: typeof ADMIN_CUSTOMER_DETAIL_INCLUDE;
}>;

export class AdminCustomerListItemDto {
  id!: number;
  name!: string;
  phone!: string | null;
  email!: string | null;
  tier!: string | null;
  completedOrderCount!: number;
  createdAt!: Date;
}

function fullName(c: { firstName: string | null; lastName: string | null }): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || '(no name)';
}

export function toAdminCustomerListItemDto(c: CustomerWithTier): AdminCustomerListItemDto {
  return {
    id: c.id,
    name: fullName(c),
    phone: c.phone,
    email: c.email,
    tier: c.tier?.label ?? null,
    completedOrderCount: c.completedOrderCount,
    createdAt: c.createdAt,
  };
}

export class AdminCustomerNoteDto {
  id!: number;
  type!: string;
  body!: string;
  authorAdminId!: number;
  createdAt!: Date;
}

export class AdminCustomerCallLogDto {
  id!: number;
  phoneCalled!: string;
  outcome!: string;
  notes!: string | null;
  authorAdminId!: number;
  createdAt!: Date;
}

export class AdminCustomerOrderSummaryDto {
  id!: number;
  orderNumber!: string;
  status!: string;
  totalAmount!: string;
  createdAt!: Date;
}

// Internal-only shape used while building the timeline — NOT the DTO field
// type. NestJS Swagger generates schemas from `@ApiProperty()`-decorated
// class fields via reflection; a plain TS union type has no runtime
// metadata to reflect, so it would come out wrong (or missing) in the
// generated OpenAPI doc a later task's typegen reads from.
// `AdminCustomerDto.activity` below is typed as `Record<string, unknown>[]`
// instead — same pattern already used for other free-form JSON fields in
// this codebase (e.g. `PublicProductDetailDto.structuredData`). The
// frontend narrows on `.type` at render time.
type ActivityEntry =
  | { type: 'ORDER'; orderId: number; orderNumber: string; status: string; occurredAt: Date }
  | { type: 'NOTE'; noteId: number; noteType: string; body: string; occurredAt: Date }
  | { type: 'CALL'; callId: number; outcome: string; occurredAt: Date };

export class AdminCustomerDto {
  id!: number;
  name!: string;
  phone!: string | null;
  email!: string | null;
  dob!: Date | null;
  tier!: string | null;
  completedOrderCount!: number;
  createdAt!: Date;
  orders!: AdminCustomerOrderSummaryDto[];
  notes!: AdminCustomerNoteDto[];
  callLogs!: AdminCustomerCallLogDto[];
  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  activity!: Record<string, unknown>[];
}

export function toAdminCustomerDto(c: CustomerWithDetail): AdminCustomerDto {
  const activity: ActivityEntry[] = [
    ...c.orders.flatMap((o) =>
      o.statusHistory.map((h) => ({
        type: 'ORDER' as const,
        orderId: o.id,
        orderNumber: o.orderNumber,
        status: h.status,
        occurredAt: h.createdAt,
      })),
    ),
    ...c.notes.map((n) => ({
      type: 'NOTE' as const,
      noteId: n.id,
      noteType: n.type,
      body: n.body,
      occurredAt: n.createdAt,
    })),
    ...c.callLogs.map((call) => ({
      type: 'CALL' as const,
      callId: call.id,
      outcome: call.outcome,
      occurredAt: call.createdAt,
    })),
  ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

  return {
    id: c.id,
    name: fullName(c),
    phone: c.phone,
    email: c.email,
    dob: c.dob,
    tier: c.tier?.label ?? null,
    completedOrderCount: c.completedOrderCount,
    createdAt: c.createdAt,
    orders: c.orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      totalAmount: o.totalAmount.toString(),
      createdAt: o.createdAt,
    })),
    notes: c.notes.map((n) => ({
      id: n.id,
      type: n.type,
      body: n.body,
      authorAdminId: n.authorAdminId,
      createdAt: n.createdAt,
    })),
    callLogs: c.callLogs.map((call) => ({
      id: call.id,
      phoneCalled: call.phoneCalled,
      outcome: call.outcome,
      notes: call.notes,
      authorAdminId: call.authorAdminId,
      createdAt: call.createdAt,
    })),
    activity,
  };
}
