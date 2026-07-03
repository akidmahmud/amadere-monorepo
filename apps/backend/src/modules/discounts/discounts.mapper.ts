import { Prisma } from '@amader/db';

export const DISCOUNT_INCLUDE = {
  products: true,
  categories: true,
  customers: true,
} as const;

export type DiscountWithScopes = Prisma.DiscountGetPayload<{
  include: typeof DISCOUNT_INCLUDE;
}>;

export function toDiscountDto(discount: DiscountWithScopes) {
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
