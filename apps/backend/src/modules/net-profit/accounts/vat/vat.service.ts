import { Injectable } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AccountsSettingsService } from '../accounts-settings.service';

const Decimal = Prisma.Decimal;
const ZERO = new Decimal(0);

export interface VatReturnLine {
  label: string;
  amount: string;
}

export interface VatReturn {
  from: string | null;
  to: string | null;
  ratePercent: number;
  binNumber: string;
  outputVat: string;
  inputVatClaimable: string;
  inputVatAtRisk: string;
  netPayable: string;
  creditCarriedForward: string;
  withheldNotDeposited: string;
  lines: VatReturnLine[];
}

export type VatRiskReason = 'NO_CHALLAN' | 'NO_SUPPLIER_BIN';

export interface VatRiskRow {
  expenseId: number;
  voucherNo: string;
  partyName: string;
  partyBin: string | null;
  expenseDate: Date;
  vatAmount: string;
  reason: VatRiskReason;
}

type ExpenseForVat = {
  id: number;
  voucherNo: string;
  expenseDate: Date;
  vatAmount: Prisma.Decimal;
  mushakChallanNo: string | null;
  aitAmount: Prisma.Decimal;
  vdsAmount: Prisma.Decimal;
  party: { name: string; bin: string | null };
};

/**
 * A Mushak 6.3 claim is tied to the supplier's BIN, so both the challan number
 * and the supplier's registration must be present. Either missing means the
 * rebate is lost on audit — such VAT is reported "at risk" rather than quietly
 * claimed, which is the whole point of the at-risk panel.
 */
function isClaimable(e: ExpenseForVat): boolean {
  return Boolean(e.mushakChallanNo) && Boolean(e.party.bin);
}

/**
 * VAT return working (Mushak 9.1) and the input-VAT-at-risk report.
 *
 * Input VAT is read from `Expense.vatAmount`, which was computed once by
 * computeExpenseAmounts() when the voucher was saved. It is deliberately NOT
 * recomputed from the gross amount here — doing that, on the assumption that
 * supplier bills are VAT-exclusive, is what overstated the claim by ~13%.
 */
@Injectable()
export class VatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AccountsSettingsService,
  ) {}

  private dateRange(from?: string, to?: string) {
    return {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
    };
  }

  private async expensesInRange(from?: string, to?: string): Promise<ExpenseForVat[]> {
    return this.prisma.client.expense.findMany({
      where: {
        voidedAt: null,
        ...(from || to ? { expenseDate: this.dateRange(from, to) } : {}),
      },
      select: {
        id: true,
        voucherNo: true,
        expenseDate: true,
        vatAmount: true,
        mushakChallanNo: true,
        aitAmount: true,
        vdsAmount: true,
        party: { select: { name: true, bin: true } },
      },
      orderBy: { expenseDate: 'asc' },
    }) as unknown as Promise<ExpenseForVat[]>;
  }

  async vatReturn(from?: string, to?: string): Promise<VatReturn> {
    const vat = await this.settings.getVatSettings();
    const expenses = await this.expensesInRange(from, to);

    // Output VAT is estimated from completed-order revenue at the store rate,
    // as it was before this redesign: no real order carries a nonzero
    // taxAmount, because tax is an internal accounting figure here rather
    // than a line the customer is charged. Revenue is treated as
    // VAT-inclusive, so the VAT within it is revenue x rate / (100 + rate).
    const revenueAgg = await this.prisma.client.order.aggregate({
      where: {
        status: 'COMPLETED',
        ...(from || to ? { completedAt: this.dateRange(from, to) } : {}),
      },
      _sum: { totalAmount: true },
    });
    const revenue = revenueAgg._sum.totalAmount ?? ZERO;
    const rate = new Decimal(vat.ratePercent);
    const outputVat = rate.isZero()
      ? ZERO
      : revenue.times(rate).dividedBy(rate.plus(100)).toDecimalPlaces(2);

    let claimable = ZERO;
    let atRisk = ZERO;
    let withheld = ZERO;
    for (const e of expenses) {
      withheld = withheld.plus(e.aitAmount).plus(e.vdsAmount);
      if (e.vatAmount.lessThanOrEqualTo(ZERO)) continue;
      if (isClaimable(e)) claimable = claimable.plus(e.vatAmount);
      else atRisk = atRisk.plus(e.vatAmount);
    }

    const net = outputVat.minus(claimable);
    // Input exceeding output is a credit that carries forward, not money NBR
    // refunds. Reporting a negative "payable" would read as a receivable.
    const netPayable = net.greaterThan(ZERO) ? net : ZERO;
    const creditCarriedForward = net.lessThan(ZERO) ? net.abs() : ZERO;

    return {
      from: from ?? null,
      to: to ?? null,
      ratePercent: vat.ratePercent,
      binNumber: vat.binNumber,
      outputVat: outputVat.toFixed(2),
      inputVatClaimable: claimable.toFixed(2),
      inputVatAtRisk: atRisk.toFixed(2),
      netPayable: netPayable.toFixed(2),
      creditCarriedForward: creditCarriedForward.toFixed(2),
      withheldNotDeposited: withheld.toFixed(2),
      lines: [
        { label: 'Output VAT on sales', amount: outputVat.toFixed(2) },
        { label: 'Input VAT claimable', amount: claimable.toFixed(2) },
        { label: 'Input VAT at risk (not claimed)', amount: atRisk.toFixed(2) },
        { label: 'Net VAT payable to NBR', amount: netPayable.toFixed(2) },
        { label: 'Credit carried forward', amount: creditCarriedForward.toFixed(2) },
        { label: 'Tax withheld at source, not yet deposited', amount: withheld.toFixed(2) },
      ],
    };
  }

  /** Every voucher whose input VAT cannot safely be claimed, and why. */
  async atRisk(from?: string, to?: string): Promise<VatRiskRow[]> {
    const expenses = await this.expensesInRange(from, to);
    return expenses
      .filter((e) => e.vatAmount.greaterThan(ZERO) && !isClaimable(e))
      .map((e) => ({
        expenseId: e.id,
        voucherNo: e.voucherNo,
        partyName: e.party.name,
        partyBin: e.party.bin,
        expenseDate: e.expenseDate,
        vatAmount: e.vatAmount.toFixed(2),
        // Challan first: it is the one the admin can usually fix immediately.
        reason: e.mushakChallanNo ? 'NO_SUPPLIER_BIN' : 'NO_CHALLAN',
      }));
  }
}
