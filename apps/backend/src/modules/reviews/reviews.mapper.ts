import { Locale, Prisma } from '@amader/db';

export const REVIEW_INCLUDE = {
  reply: true,
  customer: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  product: {
    select: {
      id: true,
      slug: true,
      translations: { select: { locale: true, name: true } },
    },
  },
} as const;

export type ReviewWithRelations = Prisma.ReviewGetPayload<{
  include: typeof REVIEW_INCLUDE;
}>;

function resolveProductName(
  product: ReviewWithRelations['product'],
  locale: Locale,
) {
  const translation =
    product.translations.find((t) => t.locale === locale) ??
    product.translations[0];
  return translation?.name ?? product.slug;
}

function customerDisplayName(customer: ReviewWithRelations['customer']) {
  const first = customer.firstName ?? 'Anonymous';
  const lastInitial = customer.lastName ? ` ${customer.lastName[0]}.` : '';
  return `${first}${lastInitial}`;
}

// Public: no customer contact details, no moderation status noise.
export function toPublicReviewDto(review: ReviewWithRelations) {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    images: review.images,
    customerName: customerDisplayName(review.customer),
    reply: review.reply
      ? { message: review.reply.message, createdAt: review.reply.createdAt }
      : null,
    createdAt: review.createdAt,
  };
}

// Owner/admin: full context needed to identify and moderate.
export function toReviewDto(review: ReviewWithRelations, locale: Locale) {
  return {
    id: review.id,
    productId: review.product.id,
    productSlug: review.product.slug,
    productName: resolveProductName(review.product, locale),
    customerId: review.customer.id,
    customerName: customerDisplayName(review.customer),
    customerEmail: review.customer.email,
    rating: review.rating,
    comment: review.comment,
    images: review.images,
    status: review.status,
    reply: review.reply
      ? { message: review.reply.message, createdAt: review.reply.createdAt }
      : null,
    createdAt: review.createdAt,
  };
}
