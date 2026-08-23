// Money math shared by the API and the admin UI. See the Accounts design
// spec §5: if those two computed the VAT split separately they would drift,
// and the user would see one number on screen and save another.
//
// Everything here is integer arithmetic in *paisa* (1 BDT = 100 paisa) and
// *basis points* (1500 = 15%). Prisma.Decimal is not usable — this file is
// imported by browser bundles, and JS floats are forbidden for money
// (AGENTS.md §5). Integers are exact in both runtimes and need no library.

export type Paisa = number;
export type BasisPoints = number;

const BP = 10_000;

/** Half-up division for non-negative integers. */
export function roundHalfUp(numerator: number, denominator: number): number {
  if (denominator <= 0) throw new Error('roundHalfUp: denominator must be positive');
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}

function assertPaisa(v: number, label: string): void {
  if (!Number.isFinite(v)) throw new Error(`${label}: not a finite number`);
  if (!Number.isInteger(v)) throw new Error(`${label}: must be an integer paisa value`);
}

export function toPaisa(bdt: string | number): Paisa {
  const n = typeof bdt === 'string' ? Number(bdt) : bdt;
  if (!Number.isFinite(n)) throw new Error(`toPaisa: not a number: ${String(bdt)}`);
  if (n < 0) throw new Error('toPaisa: amount cannot be negative');
  // toFixed(4) first: 10.005 * 100 is 1000.4999999999999 in binary floating
  // point, which would round down to 1000 instead of the correct 1001.
  return Math.round(Number((n * 100).toFixed(4)));
}

export function fromPaisa(p: Paisa): string {
  assertPaisa(p, 'fromPaisa');
  const sign = p < 0 ? '-' : '';
  const abs = Math.abs(p);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export interface ExpenseAmountsInput {
  amount: Paisa;
  amountIncludesVat: boolean;
  vatRate: BasisPoints;
  aitPercent: BasisPoints;
  vdsPercent: BasisPoints;
}

export interface ExpenseAmounts {
  netAmount: Paisa;
  vatAmount: Paisa;
  grossAmount: Paisa;
  aitAmount: Paisa;
  vdsAmount: Paisa;
  netPayable: Paisa;
}

export function computeExpenseAmounts(i: ExpenseAmountsInput): ExpenseAmounts {
  if (Number.isFinite(i.amount) && i.amount < 0) {
    throw new Error('computeExpenseAmounts: amount cannot be negative');
  }
  assertPaisa(i.amount, 'computeExpenseAmounts.amount');
  const rates: [string, number][] = [
    ['vatRate', i.vatRate],
    ['aitPercent', i.aitPercent],
    ['vdsPercent', i.vdsPercent],
  ];
  for (const [name, value] of rates) {
    assertPaisa(value, `computeExpenseAmounts.${name}`);
    if (value < 0) throw new Error(`computeExpenseAmounts: ${name} cannot be negative`);
  }

  let netAmount: Paisa;
  let vatAmount: Paisa;
  let grossAmount: Paisa;

  if (i.amountIncludesVat) {
    grossAmount = i.amount;
    netAmount = roundHalfUp(grossAmount * BP, BP + i.vatRate);
    // Derive VAT by subtraction so net + vat === gross always holds, even
    // when the division is inexact. Computing it independently would let the
    // three figures disagree by a paisa.
    vatAmount = grossAmount - netAmount;
  } else {
    netAmount = i.amount;
    vatAmount = roundHalfUp(netAmount * i.vatRate, BP);
    grossAmount = netAmount + vatAmount;
  }

  // AIT is withheld on the base value; VDS is withheld as a share of the VAT
  // itself (the options in use are one third of VAT, and full VAT).
  const aitAmount = roundHalfUp(netAmount * i.aitPercent, BP);
  const vdsAmount = roundHalfUp(vatAmount * i.vdsPercent, BP);
  const netPayable = grossAmount - aitAmount - vdsAmount;

  return { netAmount, vatAmount, grossAmount, aitAmount, vdsAmount, netPayable };
}

export type AgeingBucket = 'CURRENT' | '1_30' | '31_60' | '60_PLUS';

const DAY_MS = 24 * 60 * 60 * 1000;

export function ageingBucket(dueDate: Date | null, asOf: Date): AgeingBucket {
  if (!dueDate) return 'CURRENT';
  const days = Math.floor((asOf.getTime() - dueDate.getTime()) / DAY_MS);
  if (days <= 0) return 'CURRENT';
  if (days <= 30) return '1_30';
  if (days <= 60) return '31_60';
  return '60_PLUS';
}
