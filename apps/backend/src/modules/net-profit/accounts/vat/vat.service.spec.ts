import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@amader/db';
import { VatService } from './vat.service';
import { AccountsSettingsService } from '../accounts-settings.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';

const D = (v: string | number) => new Prisma.Decimal(v);

describe('VatService', () => {
  let service: VatService;
  let prisma: { client: Record<string, Record<string, jest.Mock>> };
  let settings: { getVatSettings: jest.Mock };

  const claimable = {
    id: 1,
    voucherNo: 'EXP-2608-0001',
    expenseDate: new Date('2026-08-05'),
    vatAmount: D('150.00'),
    netAmount: D('1000.00'),
    mushakChallanNo: 'M-1',
    aitAmount: D(0),
    vdsAmount: D(0),
    voidedAt: null,
    party: { name: 'Supplier A', bin: 'BIN-9' },
  };

  beforeEach(async () => {
    prisma = {
      client: {
        expense: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        order: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: D('7666.67') } }),
        },
      },
    };
    settings = {
      getVatSettings: jest.fn().mockResolvedValue({
        enabled: true, ratePercent: 15, binNumber: 'BIN-STORE',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VatService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccountsSettingsService, useValue: settings },
      ],
    }).compile();
    service = module.get(VatService);
  });

  describe('input VAT eligibility', () => {
    it('claims input VAT only from expenses that carry a Mushak 6.3 challan', async () => {
      prisma.client.expense.findMany.mockResolvedValue([
        claimable,
        { ...claimable, id: 2, vatAmount: D('300.00'), mushakChallanNo: null },
      ]);
      const r = await service.vatReturn('2026-08-01', '2026-08-31');
      expect(r.inputVatClaimable).toBe('150.00');
      expect(r.inputVatAtRisk).toBe('300.00');
    });

    it('treats a challan from a supplier with no BIN as at risk', async () => {
      // A Mushak 6.3 claim is tied to the supplier's BIN. Without one the
      // rebate is lost on audit, so it must not be claimed quietly.
      prisma.client.expense.findMany.mockResolvedValue([
        { ...claimable, id: 3, vatAmount: D('75.00'), party: { name: 'S', bin: null } },
      ]);
      const r = await service.vatReturn('2026-08-01', '2026-08-31');
      expect(r.inputVatClaimable).toBe('0.00');
      expect(r.inputVatAtRisk).toBe('75.00');
    });

    it('ignores expenses with no VAT at all', async () => {
      prisma.client.expense.findMany.mockResolvedValue([
        { ...claimable, id: 4, vatAmount: D(0), mushakChallanNo: null },
      ]);
      const r = await service.vatReturn('2026-08-01', '2026-08-31');
      expect(r.inputVatAtRisk).toBe('0.00');
    });
  });

  it('nets output VAT against claimable input VAT only', async () => {
    // Revenue 7666.67 at 15% inclusive gives 1000.00 output VAT.
    prisma.client.expense.findMany.mockResolvedValue([claimable]);
    const r = await service.vatReturn('2026-08-01', '2026-08-31');
    expect(r.outputVat).toBe('1000.00');
    expect(r.netPayable).toBe('850.00');
  });

  it('reports withheld AIT and VDS separately — it is not our money', async () => {
    prisma.client.expense.findMany.mockResolvedValue([
      { ...claimable, aitAmount: D('200.00'), vdsAmount: D('50.00') },
    ]);
    const r = await service.vatReturn('2026-08-01', '2026-08-31');
    expect(r.withheldNotDeposited).toBe('250.00');
  });

  it('excludes voided expenses from every figure', async () => {
    await service.vatReturn('2026-08-01', '2026-08-31');
    expect(prisma.client.expense.findMany.mock.calls[0][0].where.voidedAt).toBeNull();
  });

  it('carries the store BIN and rate onto the return', async () => {
    const r = await service.vatReturn('2026-08-01', '2026-08-31');
    expect(r.binNumber).toBe('BIN-STORE');
    expect(r.ratePercent).toBe(15);
  });

  it('produces Mushak 9.1 working lines that reconcile to the net', async () => {
    prisma.client.expense.findMany.mockResolvedValue([claimable]);
    const r = await service.vatReturn('2026-08-01', '2026-08-31');
    expect(r.lines.map((l) => l.label)).toEqual(
      expect.arrayContaining(['Output VAT on sales', 'Input VAT claimable', 'Net VAT payable to NBR']),
    );
    expect(r.lines.find((l) => l.label === 'Net VAT payable to NBR')?.amount).toBe('850.00');
  });

  it('reports zero rather than a negative net when input exceeds output', async () => {
    prisma.client.order.aggregate.mockResolvedValue({ _sum: { totalAmount: D(0) } });
    prisma.client.expense.findMany.mockResolvedValue([claimable]);
    const r = await service.vatReturn('2026-08-01', '2026-08-31');
    // A credit carries forward rather than becoming a refund NBR owes us.
    expect(r.netPayable).toBe('0.00');
    expect(r.creditCarriedForward).toBe('150.00');
  });

  describe('atRisk', () => {
    it('lists each at-risk voucher with the reason', async () => {
      prisma.client.expense.findMany.mockResolvedValue([
        { ...claimable, id: 2, voucherNo: 'EXP-2608-0002', vatAmount: D('300.00'), mushakChallanNo: null },
      ]);
      const rows = await service.atRisk('2026-08-01', '2026-08-31');
      expect(rows).toHaveLength(1);
      expect(rows[0].reason).toBe('NO_CHALLAN');
      expect(rows[0].voucherNo).toBe('EXP-2608-0002');
      expect(rows[0].vatAmount).toBe('300.00');
    });

    it('distinguishes a missing supplier BIN from a missing challan', async () => {
      prisma.client.expense.findMany.mockResolvedValue([
        { ...claimable, id: 3, party: { name: 'S', bin: null } },
      ]);
      const rows = await service.atRisk('2026-08-01', '2026-08-31');
      expect(rows[0].reason).toBe('NO_SUPPLIER_BIN');
    });

    it('omits fully compliant vouchers', async () => {
      prisma.client.expense.findMany.mockResolvedValue([claimable]);
      expect(await service.atRisk('2026-08-01', '2026-08-31')).toEqual([]);
    });
  });
});
