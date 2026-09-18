export type ReportStatus =
  'Pending' | 'Confirmed' | 'Shipped' | 'Delivered' | 'Returned' | 'Cancelled';
export const STATUSES: ReportStatus[] = [
  'Pending',
  'Confirmed',
  'Shipped',
  'Delivered',
  'Returned',
  'Cancelled',
];
export const SHIPPED_STATUSES: ReportStatus[] = [
  'Shipped',
  'Delivered',
  'Returned',
];
export type CustomerType = 'New' | 'Repeat';
export type FlagKey =
  | 'loss'
  | 'low'
  | 'over'
  | 'nocourier'
  | 'stuck'
  | 'nobill'
  | 'unconf'
  | 'nocost';

/** One order line with its cost already resolved for the order date. */
export interface ReportLine {
  /** Groups the Products tab: `v<variantId>`, `p<productId>`, or `n:<name>` once the product is gone. */
  key: string;
  name: string;
  qty: number;
  /** Unit selling price. */
  price: number;
  /** Taka off this line (the order discount, spread by value). */
  disc: number;
  /** kg per unit; 0 when unknown. */
  unitWeight: number;
  /** Cost per unit active on the order date; null = missing. */
  unitCost: number | null;
  /** False when that cost row is unconfirmed. */
  costOk: boolean;
}

export interface ReportHistory {
  confirmed?: string;
  shipped?: string;
  delivered?: string;
  returned?: string;
  cancelled?: string;
}

export interface ReportOrder {
  id: number;
  orderNumber: string;
  /** Order date, YYYY-MM-DD in Asia/Dhaka. */
  date: string;
  status: ReportStatus;
  channel: string;
  agentId: number | null;
  agentName: string | null;
  customer: string;
  phone: string;
  ctype: CustomerType;
  district: string;
  zone: string;
  lines: ReportLine[];
  /** Delivery charge the customer paid. */
  delivery: number;
  /** Payment provider key: COD, BKASH, NAGAD... */
  payment: string;
  advance: number;
  /** Courier key (CourierProviderName) or null when not set. */
  courier: string | null;
  /** What the courier billed, from the statement import; null = no bill yet. */
  actual: number | null;
  hist: ReportHistory;
}

export interface ZoneRate {
  smallMax: number;
  small: number;
  first: number;
  extra: number;
}

export interface CourierRate {
  /** COD charge, % */
  cod: number;
  codBase: 'product' | 'collect';
  /** Return charge as % of the weight rate. */
  returnPct: number;
  zones: Record<string, ZoneRate>;
}

export interface Thresholds {
  low: number;
  over: number;
  pending: number;
  bill: number;
}

export interface ReportSettings {
  rates: Record<string, CourierRate>;
  packaging: number;
  /** % on the advance, keyed by payment provider. */
  fees: Record<string, number>;
  th: Thresholds;
}

export interface CalcLine extends ReportLine {
  gross: number;
  net: number;
  weight: number;
  cogs: number | null;
}

export interface OrderCalc {
  o: ReportOrder;
  lines: CalcLine[];
  netSales: number;
  weight: number;
  zone: string;
  collect: number;
  rate: number | null;
  cod: number;
  expected: number | null;
  shipped: boolean;
  courierCharge: number | null;
  estimated: boolean;
  overcharge: number | null;
  cogs: number | null;
  packaging: number;
  fee: number;
  contribution: number | null;
  subsidy: number | null;
  receivable: number | null;
  unconfirmed: boolean;
}
