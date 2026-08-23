import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SeoService } from '../seo/seo.service';
import { ReviewsService } from '../reviews/reviews.service';
import { TokenService } from '../../common/auth/token.service';
import { RevalidationService } from '../../common/revalidation/revalidation.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

// create()/update() only need toAdminProductDto to not throw — stubbed as an
// identity function, same pattern as admin-order-creation.service.spec.ts's
// own orders.mapper mock, so this test doesn't have to also model the full
// ProductWithRelations include shape.
jest.mock('./products.mapper', () => ({
  toAdminProductDto: jest.fn((product: unknown) => product),
  toAdminProductListItemDto: jest.fn((product: unknown) => product),
  toPublicProductDto: jest.fn((product: unknown) => product),
  toPublicProductDigitalFields: jest.fn(() => ({
    digitalPageCount: null,
    digitalPreviewStartPage: null,
    digitalPreviewEndPage: null,
    previewPages: [],
  })),
}));

function createMockPrismaService() {
  const client = {
    product: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  return { client };
}

type MockPrisma = ReturnType<typeof createMockPrismaService>;

function baseCreateDto(overrides: Partial<CreateProductDto> = {}): CreateProductDto {
  return {
    slug: 'test-product',
    hasVariants: false,
    price: 500,
    translations: [{ locale: 'EN', name: 'Test Product' } as never],
    ...overrides,
  } as CreateProductDto;
}

describe('ProductsService.create/update — trackInventory forced off for DIGITAL', () => {
  let service: ProductsService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SeoService, useValue: {} },
        { provide: ReviewsService, useValue: {} },
        { provide: TokenService, useValue: {} },
        { provide: RevalidationService, useValue: { revalidate: jest.fn() } },
      ],
    }).compile();
    service = module.get(ProductsService);

    // No slug conflict for create(); update() reaches this via
    // assertSlugAvailable only when dto.slug is set (it isn't, below).
    prisma.client.product.findUnique.mockResolvedValue(null);
  });

  // A digital product has no physical stock — reserveStock/releaseStock
  // (stock-reservation.util.ts) are gated solely on trackInventory, so an
  // admin who creates a DIGITAL product and never touches this field must
  // still get trackInventory: false, not the schema's true default.
  it('forces trackInventory false when creating a DIGITAL product', async () => {
    prisma.client.product.create.mockResolvedValue({ id: 1, slug: 'ebook-1' });

    await service.create(baseCreateDto({ productType: 'DIGITAL' as never }));

    const data = prisma.client.product.create.mock.calls[0][0].data;
    expect(data.trackInventory).toBe(false);
  });

  it('leaves trackInventory alone for a PHYSICAL product', async () => {
    prisma.client.product.create.mockResolvedValue({ id: 1, slug: 'mug-1' });

    await service.create(baseCreateDto({ productType: 'PHYSICAL' as never, trackInventory: true }));

    const data = prisma.client.product.create.mock.calls[0][0].data;
    expect(data.trackInventory).toBe(true);
  });

  it('forces trackInventory false when updating an existing product to DIGITAL', async () => {
    // adminGet() (called at the top of update()) resolves the EXISTING row
    // via product.findFirst — a PHYSICAL product being converted.
    prisma.client.product.findFirst.mockResolvedValue({
      id: 2,
      productType: 'PHYSICAL',
      slug: 'converted-1',
    });
    prisma.client.product.update.mockResolvedValue({ id: 2, slug: 'converted-1' });

    await service.update(2, { productType: 'DIGITAL' } as UpdateProductDto);

    const data = prisma.client.product.update.mock.calls[0][0].data;
    expect(data.trackInventory).toBe(false);
  });

  // The payload need not repeat productType for an already-DIGITAL product
  // to still be forced — dto.productType is optional PartialType, so
  // "leave productType alone" must fall back to the existing row's type,
  // not read as "not digital".
  it('forces trackInventory false on any update to a product that is already DIGITAL', async () => {
    prisma.client.product.findFirst.mockResolvedValue({
      id: 3,
      productType: 'DIGITAL',
      slug: 'ebook-2',
    });
    prisma.client.product.update.mockResolvedValue({ id: 3, slug: 'ebook-2' });

    await service.update(3, { isFeatured: true } as UpdateProductDto);

    const data = prisma.client.product.update.mock.calls[0][0].data;
    expect(data.trackInventory).toBe(false);
  });

  it('leaves trackInventory alone when updating a PHYSICAL product', async () => {
    prisma.client.product.findFirst.mockResolvedValue({
      id: 4,
      productType: 'PHYSICAL',
      slug: 'mug-2',
    });
    prisma.client.product.update.mockResolvedValue({ id: 4, slug: 'mug-2' });

    await service.update(4, { trackInventory: false } as UpdateProductDto);

    const data = prisma.client.product.update.mock.calls[0][0].data;
    // Staff-set value passed through untouched — not silently overwritten
    // for a non-digital product.
    expect(data.trackInventory).toBe(false);
  });
});

// The manual related-products picker. Its ONE guarantee over the existing
// cross-sell/FBT code is order: what the admin drags is what the storefront
// renders. Both halves of that are asserted here — the write derives
// position from the array index, and the read sorts by it.
describe('ProductsService — manual related products keep the admin\'s order', () => {
  let service: ProductsService;
  let prisma: MockPrisma & {
    client: { productRelation: Record<string, jest.Mock>; product: Record<string, jest.Mock> };
  };

  beforeEach(async () => {
    prisma = createMockPrismaService() as never;
    prisma.client.productRelation = {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    };
    // Every requested id "exists" — the count mock echoes the size of the
    // `in` list so the existence check passes whatever the test asks for
    // (a fixed number would fail the self-reference case below, where one
    // id is filtered out before the check runs).
    prisma.client.product.count = jest.fn(
      (args: { where: { id: { in: number[] } } }) => Promise.resolve(args.where.id.in.length),
    ) as never;
    prisma.client.product.findFirst.mockResolvedValue({ id: 93, slug: 'ebook', productType: 'DIGITAL' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SeoService, useValue: {} },
        { provide: ReviewsService, useValue: {} },
        { provide: TokenService, useValue: {} },
        { provide: RevalidationService, useValue: { revalidateProduct: jest.fn() } },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('writes position from the array index, so a reorder is just a re-send', async () => {
    await service.updateRelatedProducts(93, [75, 83, 76]);

    expect(prisma.client.productRelation.deleteMany).toHaveBeenCalledWith({
      where: { fromProductId: 93, type: 'RELATED' },
    });
    expect(prisma.client.productRelation.createMany).toHaveBeenCalledWith({
      data: [
        { fromProductId: 93, toProductId: 75, type: 'RELATED', position: 0 },
        { fromProductId: 93, toProductId: 83, type: 'RELATED', position: 1 },
        { fromProductId: 93, toProductId: 76, type: 'RELATED', position: 2 },
      ],
    });
  });

  it('reads back ordered by position', async () => {
    await service.getRelatedProducts(93);

    expect(prisma.client.productRelation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fromProductId: 93, type: 'RELATED' },
        orderBy: [{ position: 'asc' }, { toProductId: 'asc' }],
      }),
    );
  });

  it('drops a self-reference rather than letting a product relate to itself', async () => {
    await service.updateRelatedProducts(93, [93, 75]);

    expect(prisma.client.productRelation.createMany).toHaveBeenCalledWith({
      data: [{ fromProductId: 93, toProductId: 75, type: 'RELATED', position: 0 }],
    });
  });
});
