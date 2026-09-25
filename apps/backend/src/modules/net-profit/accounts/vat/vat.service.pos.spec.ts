import { Prisma } from '@amader/db';
import { VatService } from './vat.service';

const D = (n: number) => new Prisma.Decimal(n);

/**
 * POS sales carry the VAT the till actually charged (POS Settings › VAT), so
 * the VAT return must use that instead of re-estimating them at the website
 * rate — otherwise POS VAT off still reports ~13% of POS revenue as VAT owed.
 */
describe('VatService.vatReturn — POS sales', () => {
  function build(websiteRevenue: number, posVat: number) {
    const aggregate = jest.fn((args: { where: { channel?: unknown } }) =>
      Promise.resolve(
        args.where.channel === 'POS'
          ? { _sum: { taxAmount: D(posVat) } }
          : { _sum: { totalAmount: D(websiteRevenue) } },
      ),
    );
    const prisma = {
      client: {
        order: { aggregate },
        orderItem: { findMany: jest.fn().mockResolvedValue([]) },
        expense: { findMany: jest.fn().mockResolvedValue([]) },
      },
    };
    const settings = { getVatSettings: jest.fn().mockResolvedValue({ enabled: true, ratePercent: 15, binNumber: '' }) };
    return { svc: new VatService(prisma as never, settings as never), aggregate };
  }

  it('website revenue is estimated without POS orders; POS adds the VAT it recorded', async () => {
    const { svc, aggregate } = build(1150, 20);
    const r = await svc.vatReturn();
    // 1150 x 15/115 = 150 (website) + 20 (POS, as charged)
    expect(r.outputVat).toBe('170.00');
    const websiteWhere = aggregate.mock.calls.find((c) => c[0].where.channel !== 'POS')![0].where;
    expect(websiteWhere.channel).toEqual({ not: 'POS' });
  });

  it('POS VAT switched off → POS sales add nothing', async () => {
    const { svc } = build(0, 0);
    expect((await svc.vatReturn()).outputVat).toBe('0.00');
  });
});
