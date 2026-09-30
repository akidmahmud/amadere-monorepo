// Daily Report (Net Profit → Daily Report).
// Spec: backend/docs/superpowers/specs/2026-10-01-daily-report-design.md

export type FixedCostType =
  | 'PER_DAY'
  | 'PER_MONTH'
  | 'PERCENT_OF_SALES'
  | 'MARKETING_LEDGER';
export type FixedCostScope = 'REPORT' | 'SOURCE';

export interface DailyReportFixedCost {
  id: string;
  name: string;
  type: FixedCostType;
  /** ৳ for PER_DAY / PER_MONTH, % for PERCENT_OF_SALES, ignored for MARKETING_LEDGER. */
  amount: number;
  scope: FixedCostScope;
  /** Required when scope = SOURCE. */
  sourceKey?: string;
  active: boolean;
}

export interface DailyReportSourceSetting {
  key: string;
  enabled: boolean;
}

export interface DailyReportSettings {
  autoEnabled: boolean;
  /** Stored order = report order. */
  sources: DailyReportSourceSetting[];
  fixedCosts: DailyReportFixedCost[];
}

/** Settings as the admin sees them: every known source, labelled, in report order. */
export interface DailyReportSettingsView extends DailyReportSettings {
  sources: (DailyReportSourceSetting & { label: string })[];
}

export interface DailyReportTotals {
  qty: number;
  sales: number;
  avg: number;
  cost: number;
  delivery: number;
  profit: number;
}

export interface DailyReportProductRow {
  key: string;
  name: string;
  qty: number;
  sales: number;
  avg: number;
  costPerKg: number;
  cost: number;
  profit: number;
  /** Lines of this product with no cost (counted as ৳0). */
  estimated: number;
}

export interface DailyReportAppliedCost {
  id: string;
  name: string;
  type: FixedCostType;
  amount: number;
  value: number;
}

export interface DailyReportSourceBlock {
  key: string;
  label: string;
  products: DailyReportProductRow[];
  subtotal: DailyReportTotals;
  fixedCosts: DailyReportAppliedCost[];
  /** profit − delivery − this source's fixed costs */
  net: number;
}

export interface DailyReportSnapshot {
  from: string;
  to: string;
  generatedAt: string;
  sources: DailyReportSourceBlock[];
  grandTotal: DailyReportTotals;
  reportFixedCosts: DailyReportAppliedCost[];
  netProfit: number;
  estimatedLines: number;
  orderIds: number[];
  wholesaleOrderIds: number[];
}

export type DailyReportKind = 'AUTO' | 'MANUAL';

export interface DailyReportListItem {
  id: number;
  name: string;
  kind: DailyReportKind;
  from: string;
  to: string;
  totalSales: number;
  netProfit: number;
  createdByName: string | null;
  createdAt: string;
}

export interface DailyReportDetail extends DailyReportListItem {
  snapshot: DailyReportSnapshot;
  /** Orders cancelled / returned / deleted AFTER generation. */
  changed: { orders: number; amount: number };
  /** AUTO only: the previous day's AUTO report, if still kept. */
  previous: { id: number; totalSales: number; netProfit: number } | null;
}
