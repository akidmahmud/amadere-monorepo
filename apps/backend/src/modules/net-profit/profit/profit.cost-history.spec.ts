import { Test } from '@nestjs/testing';
import { Prisma } from '@amader/db';
import { ProfitService } from './profit.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NetProfitSettingsService } from '../settings/net-profit-settings.service';
import { ProductCostHistoryService } from '../../product-cost-history/product-cost-history.service';

describe('ProfitService cost writers record dated history', () => {
  const history = { recordIfChanged: jest.fn() };
  const prisma = {
    client: {
      product: {
        update: jest
          .fn()
          .mockResolvedValue({
            id: 7,
            costPerItem: new Prisma.Decimal(90),
            costPriceUnit: null,
          }),
        findUnique: jest.fn(),
      },
      productVariant: {
        update: jest
          .fn()
          .mockResolvedValue({
            id: 70,
            productId: 7,
            costPerItem: new Prisma.Decimal(40),
          }),
      },
      $transaction: jest.fn((ops: unknown[]) =>
        Promise.all(ops as Promise<unknown>[]),
      ),
    },
  };
  let svc: ProfitService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [
        ProfitService,
        { provide: PrismaService, useValue: prisma },
        { provide: NetProfitSettingsService, useValue: {} },
        { provide: ProductCostHistoryService, useValue: history },
      ],
    }).compile();
    svc = mod.get(ProfitService);
  });

  it('setVariantCost records the variant cost', async () => {
    await svc.setVariantCost(70, new Prisma.Decimal(40)).catch(() => undefined);
    expect(history.recordIfChanged).toHaveBeenCalledWith({
      productId: 7,
      variantId: 70,
      cost: 40,
    });
  });

  it('bulkSetProductCost records each product cost', async () => {
    await svc.bulkSetProductCost([{ productId: 7, costPerItem: 90 }]);
    expect(history.recordIfChanged).toHaveBeenCalledWith({
      productId: 7,
      cost: 90,
      costPriceUnit: null,
    });
  });
});
