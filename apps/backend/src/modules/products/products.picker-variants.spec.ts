import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SeoService } from '../seo/seo.service';
import { ReviewsService } from '../reviews/reviews.service';
import { TokenService } from '../../common/auth/token.service';
import { RevalidationService } from '../../common/revalidation/revalidation.service';
import { CatalogFeedService } from '../catalog-feed/catalog-feed.service';
import { ProductCostHistoryService } from '../product-cost-history/product-cost-history.service';

// The wholesale order form sells off this list. It used to collapse each
// product to its default variant, so a product with two pack sizes could only
// be sold as one of them — and an admin-only variant, which is never the
// default, could not be sold at all.

const decimal = (v: string) => ({ toString: () => v });

const row = {
  id: 1,
  slug: 'fiber-mix',
  stockStatus: 'IN_STOCK',
  sku: null,
  price: decimal('900'),
  salePrice: decimal('800'),
  wholesalePrice: decimal('700'),
  translations: [{ name: 'Amader Fiber Mix' }],
  media: [],
  variants: [
    {
      id: 10,
      price: decimal('900'),
      salePrice: decimal('800'),
      wholesalePrice: decimal('700'),
      sku: 'Amader Fiber Mix 500gm',
      isDefault: true,
      stockStatus: 'IN_STOCK',
      isAdminOnly: false,
    },
    {
      id: 11,
      price: decimal('1800'),
      salePrice: decimal('1550'),
      wholesalePrice: null,
      sku: 'Amader Fiber Mix 1kg',
      isDefault: false,
      stockStatus: 'IN_STOCK',
      isAdminOnly: true,
    },
  ],
};

describe('ProductsService.adminPickerList — every variant, not just the default', () => {
  let service: ProductsService;
  let findMany: jest.Mock;

  beforeEach(async () => {
    findMany = jest.fn().mockResolvedValue([row]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: { client: { product: { findMany } } } },
        { provide: SeoService, useValue: {} },
        { provide: ReviewsService, useValue: {} },
        { provide: TokenService, useValue: {} },
        { provide: RevalidationService, useValue: { revalidate: jest.fn() } },
        { provide: CatalogFeedService, useValue: { invalidate: jest.fn() } },
        { provide: ProductCostHistoryService, useValue: { recordIfChanged: jest.fn() } },
      ],
    }).compile();
    service = module.get(ProductsService);
  });

  it('returns both pack sizes, each with its own price and SKU', async () => {
    const [item] = await service.adminPickerList();

    expect(item.variants.map((v) => v.id)).toEqual([10, 11]);
    expect(item.variants[1]).toMatchObject({
      sku: 'Amader Fiber Mix 1kg',
      price: '1800',
      salePrice: '1550',
      wholesalePrice: null,
    });
  });

  it('includes the admin-only variant, flagged', async () => {
    const [item] = await service.adminPickerList();

    expect(item.variants.find((v) => v.id === 11)?.isAdminOnly).toBe(true);
  });

  it('still reports the default variant at the top level for relation pickers', async () => {
    const [item] = await service.adminPickerList();

    expect(item).toMatchObject({ name: 'Amader Fiber Mix', price: '900', sku: 'Amader Fiber Mix 500gm' });
  });
});
