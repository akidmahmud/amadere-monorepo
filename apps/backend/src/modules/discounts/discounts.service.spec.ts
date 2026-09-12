import {
  ContentStatus,
  DiscountType,
  DiscountValueType,
  Prisma,
} from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DiscountsService } from './discounts.service';

function discountRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    code: 'SAVE10',
    type: DiscountType.COUPON,
    valueType: DiscountValueType.PERCENTAGE,
    value: { toString: () => '10' },
    minOrderAmount: null,
    maxUsesTotal: null,
    maxUsesPerCustomer: null,
    usedCount: 0,
    startsAt: null,
    endsAt: null,
    status: ContentStatus.DRAFT,
    products: [],
    categories: [],
    customers: [],
    ...overrides,
  };
}

describe('DiscountsService date schedules', () => {
  it('converts date-only schedule values to inclusive Bangladesh day boundaries', async () => {
    let createData: Prisma.DiscountCreateInput | undefined;
    const prisma = {
      client: {
        discount: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest
            .fn()
            .mockImplementation(({ data }: Prisma.DiscountCreateArgs) => {
              createData = data;
              return Promise.resolve(
                discountRow({
                  startsAt: createData.startsAt,
                  endsAt: createData.endsAt,
                }),
              );
            }),
        },
      },
    };
    const service = new DiscountsService(prisma as unknown as PrismaService);

    await service.create({
      code: 'SAVE10',
      type: DiscountType.COUPON,
      valueType: DiscountValueType.PERCENTAGE,
      value: 10,
      startsAt: '2026-09-12',
      endsAt: '2026-09-12',
    });

    expect(createData?.startsAt).toEqual(new Date('2026-09-11T18:00:00.000Z'));
    expect(createData?.endsAt).toEqual(new Date('2026-09-12T17:59:59.999Z'));
  });
});
