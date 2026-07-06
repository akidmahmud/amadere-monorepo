import {
  ContentStatus,
  DiscountType,
  DiscountValueType,
  Prisma,
} from '@amader/db';

export const DISCOUNT_INCLUDE = {
  products: true,
  categories: true,
  customers: true,
} as const;

export type DiscountWithScopes = Prisma.DiscountGetPayload<{
  include: typeof DISCOUNT_INCLUDE;
}>;

export class DiscountDto {
  id!: number;
  code!: string | null;
  type!: DiscountType;
  valueType!: DiscountValueType;
  value!: string;
  minOrderAmount!: string | null;
  maxUsesTotal!: number | null;
  maxUsesPerCustomer!: number | null;
  usedCount!: number;
  startsAt!: Date | null;
  endsAt!: Date | null;
  status!: ContentStatus;
  productIds!: number[];
  categoryIds!: number[];
  customerIds!: number[];
}

export function toDiscountDto(discount: DiscountWithScopes): DiscountDto {
  return {
    id: discount.id,
    code: discount.code,
    type: discount.type,
    valueType: discount.valueType,
    value: discount.value.toString(),
    minOrderAmount: discount.minOrderAmount?.toString() ?? null,
    maxUsesTotal: discount.maxUsesTotal,
    maxUsesPerCustomer: discount.maxUsesPerCustomer,
    usedCount: discount.usedCount,
    startsAt: discount.startsAt,
    endsAt: discount.endsAt,
    status: discount.status,
    productIds: discount.products.map((p) => p.productId),
    categoryIds: discount.categories.map((c) => c.categoryId),
    customerIds: discount.customers.map((c) => c.customerId),
  };
}
