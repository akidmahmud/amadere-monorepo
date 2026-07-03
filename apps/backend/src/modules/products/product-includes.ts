// Shared Prisma `include` shape for a fully-loaded product, used by both the
// admin and public mappers so the query and the types they map from stay in sync.
export const PRODUCT_INCLUDE = {
  translations: true,
  brand: { include: { translations: true } },
  categories: { include: { category: { include: { translations: true } } } },
  tags: { include: { tag: { include: { translations: true } } } },
  attributes: { include: { attribute: { include: { translations: true } } } },
  media: { include: { media: true }, orderBy: { sortOrder: 'asc' as const } },
  variants: {
    include: {
      attributeValues: {
        include: { attributeValue: { include: { translations: true } } },
      },
    },
    orderBy: { sortOrder: 'asc' as const },
  },
} as const;
