import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { SalesPostingService } from './sales-posting.service';
import { LedgerService } from './ledger.service';
import { DuesService } from '../dues/dues.service';
import { PartiesService } from '../parties/parties.service';
import { AccountsSettingsService } from '../accounts-settings.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';

const D = (v: string | number) => new Prisma.Decimal(v);

describe('SalesPostingService', () => {
  let service: SalesPostingService;
  let ledger: { post: jest.Mock };
  let dues: { create: jest.Mock };
  let parties: { resolveCourierParty: jest.Mock };
  let settings: { getPostingSettings: jest.Mock };
  let prisma: { client: { due: { findFirst: jest.Mock } } };

  beforeEach(async () => {
    ledger = { post: jest.fn().mockResolvedValue({ id: 1 }) };
    dues = { create: jest.fn().mockResolvedValue({ id: 9 }) };
    parties = { resolveCourierParty: jest.fn().mockResolvedValue({ id: 4, name: 'Steadfast' }) };
    settings = { getPostingSettings: jest.fn().mockResolvedValue({ defaultCashAccountId: 2 }) };
    prisma = { client: { due: { findFirst: jest.fn().mockResolvedValue(null) } } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesPostingService,
        { provide: LedgerService, useValue: ledger },
        { provide: DuesService, useValue: dues },
        { provide: PartiesService, useValue: parties },
        { provide: AccountsSettingsService, useValue: settings },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(SalesPostingService);
  });

  describe('postPrepaidCapture', () => {
    const input = {
      orderId: 12,
      amount: D('2500.00'),
      capturedAt: new Date('2026-08-12'),
      reference: 'TRX99',
    };

    it('books cash in on the capture date', async () => {
      await service.postPrepaidCapture(input);
      const posted = ledger.post.mock.calls[0][0];
      expect(posted.direction).toBe('IN');
      expect(posted.source).toBe('SALE');
      expect(posted.orderId).toBe(12);
      expect(posted.accountId).toBe(2);
      expect(posted.reference).toBe('TRX99');
      expect(new Prisma.Decimal(posted.amount).toFixed(2)).toBe('2500.00');
    });

    it('skips posting when no default cash account is configured, without throwing', async () => {
      // Money cannot be booked to an account nobody chose, but a missing
      // setting must never fail a customer's payment verification.
      settings.getPostingSettings.mockResolvedValue({ defaultCashAccountId: null });
      await expect(service.postPrepaidCapture(input)).resolves.toBeUndefined();
      expect(ledger.post).not.toHaveBeenCalled();
    });

    it('swallows a ledger failure rather than breaking order processing', async () => {
      ledger.post.mockRejectedValue(new Error('db down'));
      await expect(service.postPrepaidCapture(input)).resolves.toBeUndefined();
    });
  });

  describe('openCodReceivable', () => {
    const input = {
      orderId: 12,
      shipmentId: 30,
      provider: 'STEADFAST' as const,
      codAmount: D('1200.00'),
      dispatchedAt: new Date('2026-08-12'),
    };

    it('does NOT book cash for a COD dispatch — it opens a receivable against the courier', async () => {
      // Defect D3: the money is in the courier's merchant balance, not ours.
      await service.openCodReceivable(input);
      expect(ledger.post).not.toHaveBeenCalled();
      const due = dues.create.mock.calls[0][0];
      expect(due.kind).toBe('RECEIVABLE');
      expect(due.source).toBe('COD_IN_TRANSIT');
      expect(due.partyId).toBe(4);
      expect(due.orderId).toBe(12);
      expect(due.amount).toBe('1200.00');
    });

    it('resolves the courier party by provider rather than assuming Steadfast', async () => {
      await service.openCodReceivable({ ...input, provider: 'PATHAO' });
      expect(parties.resolveCourierParty).toHaveBeenCalledWith('PATHAO');
    });

    it('is idempotent — a retried webhook does not open a second receivable', async () => {
      prisma.client.due.findFirst.mockResolvedValue({ id: 9 });
      await service.openCodReceivable(input);
      expect(dues.create).not.toHaveBeenCalled();
    });

    it('ignores a zero COD amount', async () => {
      await service.openCodReceivable({ ...input, codAmount: D(0) });
      expect(dues.create).not.toHaveBeenCalled();
    });

    it('does not break dispatch when the courier has no mapped party', async () => {
      parties.resolveCourierParty.mockRejectedValue(new BadRequestException('no party'));
      await expect(service.openCodReceivable(input)).resolves.toBeUndefined();
    });
  });

  describe('postRefund', () => {
    it('books a refund as cash out', async () => {
      await service.postRefund({
        orderId: 12,
        amount: D('500.00'),
        refundedAt: new Date('2026-08-14'),
      });
      const posted = ledger.post.mock.calls[0][0];
      expect(posted.direction).toBe('OUT');
      expect(posted.source).toBe('REFUND');
      expect(posted.orderId).toBe(12);
    });

    it('swallows a ledger failure rather than breaking the refund', async () => {
      ledger.post.mockRejectedValue(new Error('db down'));
      await expect(
        service.postRefund({ orderId: 12, amount: D('500.00'), refundedAt: new Date() }),
      ).resolves.toBeUndefined();
    });
  });
});
