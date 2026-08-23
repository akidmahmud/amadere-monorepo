import { BadRequestException, Injectable } from '@nestjs/common';
import { CourierProviderName, Prisma } from '@amader/db';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { ExpensesService } from '../expenses/expenses.service';
import { PartiesService } from '../parties/parties.service';
import { CreateSettlementDto } from './dto/create-settlement.dto';

const Decimal = Prisma.Decimal;
const ZERO = new Decimal(0);

/** The category courier delivery charges are booked under. Seeded in seed.ts. */
const COURIER_CATEGORY_NAME = 'Courier & Logistics';

export interface PendingCodBatch {
  provider: string;
  partyId: number | null;
  partyName: string | null;
  shipmentCount: number;
  codCollected: string;
  courierCharges: string;
  expected: string;
}

interface BatchShipment {
  id: number;
  orderId: number;
  provider: CourierProviderName;
  cost: Prisma.Decimal | null;
  codAmount: Prisma.Decimal | null;
}

function sum(values: (Prisma.Decimal | null)[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((acc, v) => acc.plus(v ?? ZERO), new Decimal(0));
}

/**
 * Courier payouts.
 *
 * This is the one step in the whole money flow that needs a human number: the
 * courier remits COD collected minus their delivery charges, and no webhook
 * reports the figure. An admin enters what actually landed, matching one line
 * on the bank statement, and the batch clears.
 *
 * Charges are tracked per shipment (Shipment.cost, which gives per-order
 * profitability) but billed per settlement, because one invoice per settlement
 * is what the courier actually issues and what carries the challan number.
 * One expense voucher per parcel would mean thousands of vouchers a month and
 * per-parcel VAT challans that do not exist.
 */
@Injectable()
export class CodSettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly expenses: ExpensesService,
    private readonly parties: PartiesService,
  ) {}

  private async unsettledShipments(
    provider?: CourierProviderName,
    shipmentIds?: number[],
  ): Promise<BatchShipment[]> {
    return this.prisma.client.shipment.findMany({
      where: {
        ...(provider ? { provider } : {}),
        // Never settle the same shipment twice.
        codSettlementId: null,
        status: { in: ['DELIVERED', 'PARTIALLY_DELIVERED'] },
        codAmount: { gt: 0 },
        ...(shipmentIds ? { id: { in: shipmentIds } } : {}),
      },
      select: { id: true, orderId: true, provider: true, cost: true, codAmount: true },
    });
  }

  /** What each courier currently owes us, grouped for the settlement screen. */
  async pending(provider?: CourierProviderName): Promise<PendingCodBatch[]> {
    const shipments = await this.unsettledShipments(provider);

    const byProvider = new Map<CourierProviderName, BatchShipment[]>();
    for (const shipment of shipments) {
      const list = byProvider.get(shipment.provider) ?? [];
      list.push(shipment);
      byProvider.set(shipment.provider, list);
    }

    const batches: PendingCodBatch[] = [];
    for (const [name, list] of byProvider) {
      const codCollected = sum(list.map((s) => s.codAmount));
      const courierCharges = sum(list.map((s) => s.cost));
      // A missing courier party is reported rather than thrown: the overview
      // should still render, with the gap visible.
      let party: { id: number; name: string } | null = null;
      try {
        party = await this.parties.resolveCourierParty(name);
      } catch {
        party = null;
      }
      batches.push({
        provider: name,
        partyId: party?.id ?? null,
        partyName: party?.name ?? null,
        shipmentCount: list.length,
        codCollected: codCollected.toFixed(2),
        courierCharges: courierCharges.toFixed(2),
        expected: codCollected.minus(courierCharges).toFixed(2),
      });
    }
    return batches;
  }

  private async courierCategoryId(): Promise<number> {
    const category = await this.prisma.client.expenseCategory.findFirst({
      where: { name: COURIER_CATEGORY_NAME },
    });
    if (!category) {
      throw new BadRequestException(
        `Expense category "${COURIER_CATEGORY_NAME}" is missing. Create it in Accounts > Settings before settling.`,
      );
    }
    return category.id;
  }

  async settle(
    dto: CreateSettlementDto,
    adminId: number,
  ): Promise<{ id: number; adjustment: string }> {
    const courier = await this.parties.resolveCourierParty(dto.provider);
    const categoryId = await this.courierCategoryId();

    const shipments = await this.unsettledShipments(dto.provider, dto.shipmentIds);
    if (shipments.length === 0) {
      throw new BadRequestException(
        `No unsettled delivered COD shipments for ${dto.provider}`,
      );
    }

    const codCollected = sum(shipments.map((s) => s.codAmount));
    const courierCharges = sum(shipments.map((s) => s.cost));
    const netPayout = new Decimal(dto.netPayout);
    // Where courier disputes hide. Surfaced on the settlement, never absorbed
    // into the cash figure.
    const adjustment = netPayout.minus(codCollected.minus(courierCharges));
    const settlementDate = new Date(dto.settlementDate);
    await this.ledger.assertPeriodOpen(settlementDate);

    const settlement = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.codSettlement.create({
        data: {
          provider: dto.provider,
          partyId: courier.id,
          settlementDate,
          codCollected,
          courierCharges,
          netPayout,
          adjustment,
          accountId: dto.accountId,
          reference: dto.reference ?? null,
          note: dto.note ?? null,
          createdBy: adminId,
        },
      });

      await tx.shipment.updateMany({
        where: { id: { in: shipments.map((s) => s.id) } },
        data: { codSettlementId: created.id },
      });

      // Clear each COD_IN_TRANSIT receivable at face value. These entries
      // carry dueId so the receivable actually settles. The account does not
      // end up overstated: the courier's charges are booked as an expense
      // (below), so the three legs net to the payout that reached the bank.
      const openDues = await tx.due.findMany({
        where: {
          orderId: { in: shipments.map((s) => s.orderId) },
          source: 'COD_IN_TRANSIT',
          voidedAt: null,
        },
        select: { id: true, orderId: true },
      });
      for (const due of openDues) {
        const shipment = shipments.find((s) => s.orderId === due.orderId);
        if (!shipment?.codAmount) continue;
        await this.ledger.post(
          {
            entryDate: settlementDate,
            direction: 'IN',
            amount: shipment.codAmount,
            accountId: dto.accountId,
            partyId: courier.id,
            source: 'COD_REMITTANCE',
            dueId: due.id,
            orderId: due.orderId,
            note: `Settlement #${created.id}`,
          },
          adminId,
          tx,
        );
      }

      // The discrepancy needs its own entry, or the account balance says one
      // thing and the bank statement another. With the receivables cleared at
      // face value and the charges booked as an expense, the ledger nets to
      // the *expected* payout; this leg reconciles it to what actually landed.
      if (!adjustment.isZero()) {
        await this.ledger.post(
          {
            entryDate: settlementDate,
            direction: adjustment.greaterThan(ZERO) ? 'IN' : 'OUT',
            amount: adjustment.abs(),
            accountId: dto.accountId,
            partyId: courier.id,
            source: 'ADJUSTMENT',
            note:
              `Settlement #${created.id} discrepancy: courier paid ` +
              `${netPayout.toFixed(2)} against an expected ${codCollected.minus(courierCharges).toFixed(2)}`,
          },
          adminId,
          tx,
        );
      }

      return created;
    });

    // The delivery charges: one voucher per settlement, matching the invoice
    // the courier actually issues. Created outside the transaction because
    // ExpensesService owns its own; a failure here leaves the settlement
    // recorded and the voucher missing, which is visible and fixable, rather
    // than rolling back a payout that really happened.
    if (courierCharges.greaterThan(ZERO)) {
      const expense = await this.expenses.create(
        {
          expenseDate: dto.settlementDate,
          categoryId,
          partyId: courier.id,
          amount: courierCharges.toFixed(2),
          amountIncludesVat: true,
          vatRate: '0',
          paymentStatus: 'paid',
          paidFromAccountId: dto.accountId,
          note: `Delivery charges, settlement #${settlement.id} (${shipments.length} shipments)`,
        },
        adminId,
      );
      await this.prisma.client.codSettlement.update({
        where: { id: settlement.id },
        data: { expenseId: expense.id },
      });
    }

    return { id: settlement.id, adjustment: adjustment.toFixed(2) };
  }
}
