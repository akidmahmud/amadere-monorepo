import { Injectable, Logger } from '@nestjs/common';
import { CourierProviderName, Prisma } from '@amader/db';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { LedgerService } from './ledger.service';
import { DuesService } from '../dues/dues.service';
import { PartiesService } from '../parties/parties.service';
import { AccountsSettingsService } from '../accounts-settings.service';

export interface PrepaidCaptureInput {
  orderId: number;
  amount: Prisma.Decimal;
  capturedAt: Date;
  reference?: string;
  /** Overrides the configured default account when the caller knows better. */
  accountId?: number;
}

export interface OpenCodReceivableInput {
  orderId: number;
  shipmentId: number;
  provider: CourierProviderName;
  codAmount: Prisma.Decimal;
  dispatchedAt: Date;
}

export interface RefundInput {
  orderId: number;
  amount: Prisma.Decimal;
  refundedAt: Date;
  accountId?: number;
}

/**
 * Where order money enters the Accounts ledger.
 *
 * The important distinction is between prepaid and COD. A prepaid capture is
 * cash we hold, so it posts immediately. A COD dispatch is not: the money sits
 * in the courier's merchant balance until they settle, minus their delivery
 * charge. Booking it as cash at dispatch (or at order completion, as the
 * previous implementation did) reports money we cannot spend.
 *
 * Every method here is best-effort. A ledger posting that fails is a
 * reporting gap to reconcile later; it must never fail a customer's order,
 * payment verification or refund. Failures are logged, not thrown.
 */
@Injectable()
export class SalesPostingService {
  private readonly logger = new Logger(SalesPostingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly dues: DuesService,
    private readonly parties: PartiesService,
    private readonly settings: AccountsSettingsService,
  ) {}

  private async resolveAccountId(explicit?: number): Promise<number | null> {
    if (explicit) return explicit;
    const { defaultCashAccountId } = await this.settings.getPostingSettings();
    return defaultCashAccountId;
  }

  async postPrepaidCapture(input: PrepaidCaptureInput): Promise<void> {
    try {
      const accountId = await this.resolveAccountId(input.accountId);
      if (!accountId) {
        // Deliberately not a guess. Booking a customer's payment into an
        // arbitrary account is worse than not booking it, because the wrong
        // balance looks right.
        this.logger.warn(
          `Order ${input.orderId}: prepaid capture not posted — no default cash account configured (Accounts > Settings).`,
        );
        return;
      }
      await this.ledger.post(
        {
          entryDate: input.capturedAt,
          direction: 'IN',
          amount: input.amount,
          accountId,
          source: 'SALE',
          orderId: input.orderId,
          reference: input.reference ?? null,
          note: `Order payment`,
        },
        null,
      );
    } catch (err) {
      this.logger.error(
        `Order ${input.orderId}: failed to post prepaid capture to the ledger — ${(err as Error).message}`,
      );
    }
  }

  /**
   * A dispatched COD order becomes a receivable against the courier, not cash.
   * It is cleared by the settlement that actually pays us (see
   * CodSettlementService).
   */
  async openCodReceivable(input: OpenCodReceivableInput): Promise<void> {
    try {
      if (input.codAmount.lessThanOrEqualTo(0)) return;

      // Courier webhooks retry, and a dispatch can be re-run. A second
      // COD_IN_TRANSIT receivable for the same order would double the "with
      // courier" figure and never clear.
      const existing = await this.prisma.client.due.findFirst({
        where: { orderId: input.orderId, source: 'COD_IN_TRANSIT', voidedAt: null },
      });
      if (existing) return;

      const courier = await this.parties.resolveCourierParty(input.provider);
      await this.dues.create(
        {
          kind: 'RECEIVABLE',
          source: 'COD_IN_TRANSIT',
          partyId: courier.id,
          orderId: input.orderId,
          amount: input.codAmount.toFixed(2),
          issueDate: input.dispatchedAt.toISOString().slice(0, 10),
          note: `COD in transit — shipment #${input.shipmentId}`,
        },
        null,
      );
    } catch (err) {
      this.logger.error(
        `Order ${input.orderId}: failed to open COD receivable — ${(err as Error).message}`,
      );
    }
  }

  async postRefund(input: RefundInput): Promise<void> {
    try {
      const accountId = await this.resolveAccountId(input.accountId);
      if (!accountId) {
        this.logger.warn(
          `Order ${input.orderId}: refund not posted — no default cash account configured.`,
        );
        return;
      }
      await this.ledger.post(
        {
          entryDate: input.refundedAt,
          direction: 'OUT',
          amount: input.amount,
          accountId,
          source: 'REFUND',
          orderId: input.orderId,
          note: 'Order refund',
        },
        null,
      );
    } catch (err) {
      this.logger.error(
        `Order ${input.orderId}: failed to post refund to the ledger — ${(err as Error).message}`,
      );
    }
  }
}
