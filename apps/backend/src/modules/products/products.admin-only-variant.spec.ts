import { toPublicProductDto, toAdminProductDto } from './products.mapper';

// Guards the flag added in 20260903000000_variant_admin_only.
//
// Unlike ContentStatus.ADMIN_ONLY on Product — which is hidden by
// construction because every public read filters `status = 'PUBLISHED'` by
// equality — a hidden VARIANT is only hidden because six public reads
// exclude it explicitly. Four of those are Prisma `where` clauses and are
// covered by the query shape; the two that filter in TypeScript are asserted
// here, along with the admin side still seeing everything.
//
// Adding a seventh public read? Add a case here.

const attributeValue = {
  attributeValueId: 1,
  attributeValue: {
    attributeId: 1,
    colorHex: null,
    translations: [{ locale: 'EN', value: '1kg' }],
  },
};

const variant = (id: number, isAdminOnly: boolean) => ({
  id,
  sku: `sku-${id}`,
  barcode: null,
  price: '100',
  salePrice: null,
  costPerItem: null,
  stock: 5,
  reservedStock: 0,
  stockStatus: 'IN_STOCK',
  weightOverride: null,
  isDefault: !isAdminOnly,
  isAdminOnly,
  sortOrder: 0,
  attributeValues: [attributeValue],
});

const product = {
  id: 1,
  slug: 'jober-chatu',
  status: 'PUBLISHED',
  productType: 'PHYSICAL',
  hasVariants: true,
  price: null,
  salePrice: null,
  stock: 0,
  reservedStock: 0,
  stockStatus: 'IN_STOCK',
  translations: [{ locale: 'EN', name: 'Jober Chatu', faqs: [] }],
  categories: [],
  tags: [],
  attributes: [],
  media: [],
  previewPages: [],
  brand: null,
  author: null,
  // one public, one staff-only
  variants: [variant(10, false), variant(11, true)],
} as never;

describe('admin-only variants', () => {
  describe('toPublicProductDto (surface #1 — PDP, collections)', () => {
    it('drops the admin-only variant entirely', () => {
      const dto = toPublicProductDto(product, 'EN' as never) as {
        variants: { id: number }[];
      };
      expect(dto.variants.map((v) => v.id)).toEqual([10]);
    });

    it('leaks no trace of it — not even a flagged, hidden entry', () => {
      const dto = toPublicProductDto(product, 'EN' as never);
      expect(JSON.stringify(dto)).not.toContain('sku-11');
    });
  });

  describe('toAdminProductDto (staff side)', () => {
    it('still returns both variants', () => {
      const dto = toAdminProductDto(product) as { variants: { id: number }[] };
      expect(dto.variants.map((v) => v.id)).toEqual([10, 11]);
    });

    it('exposes the flag so the admin UI can badge the row', () => {
      const dto = toAdminProductDto(product) as {
        variants: { id: number; isAdminOnly: boolean }[];
      };
      expect(dto.variants.find((v) => v.id === 11)?.isAdminOnly).toBe(true);
      expect(dto.variants.find((v) => v.id === 10)?.isAdminOnly).toBe(false);
    });
  });

  describe('a product whose only remaining variant is admin-only', () => {
    it('renders publicly with no variants rather than exposing it', () => {
      const hiddenOnly = { ...(product as object), variants: [variant(11, true)] } as never;
      const dto = toPublicProductDto(hiddenOnly, 'EN' as never) as {
        variants: unknown[];
      };
      expect(dto.variants).toEqual([]);
    });
  });
});
