// Shared Prisma `include` shape for a fully-loaded product, used by both the
// admin and public mappers so the query and the types they map from stay in sync.
export const PRODUCT_INCLUDE = {
  translations: {
    include: { faqs: { orderBy: { sortOrder: 'asc' as const } } },
  },
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

// The admin Products table (and only that table) — deliberately excludes
// everything PRODUCT_INCLUDE pulls in that the table never renders: FAQs,
// brand/category/tag/attribute translations, and every variant's attribute
// value chain. Same rationale as AdminProductPickerItemDto: reusing the full
// include for a 20-row list page was doing 5-10x the necessary joins per
// row, and got slower as the catalog and its variant/attribute data grew.
export const PRODUCT_LIST_INCLUDE = {
  // description (short description) and media.altText below aren't rendered
  // by the table itself — they feed computeSeoScore's checks, same as the
  // full adminList query already did.
  translations: { select: { name: true, description: true }, orderBy: { locale: 'asc' as const }, take: 1 },
  categories: { select: { categoryId: true } },
  media: {
    select: { isPrimary: true, media: { select: { url: true, altText: true } } },
    orderBy: { sortOrder: 'asc' as const },
  },
  variants: {
    select: {
      id: true,
      sku: true,
      stock: true,
      reservedStock: true,
      stockStatus: true,
      price: true,
      salePrice: true,
      isDefault: true,
    },
    orderBy: { sortOrder: 'asc' as const },
  },
} as const;
