import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export type FlagKey =
  | "loss"
  | "low"
  | "over"
  | "nocourier"
  | "stuck"
  | "nobill"
  | "unconf"
  | "nocost";
export type Status =
  "Pending" | "Confirmed" | "Shipped" | "Delivered" | "Returned" | "Cancelled";

export interface ReportFilters {
  basis: "order" | "delivered";
  from: string;
  to: string;
  /** HH:mm (Dhaka) narrowing the first / last day; "" = whole day. */
  fromTime: string;
  toTime: string;
  channel: string;
  agent: string;
  courier: string;
  district: string;
  status: string;
}

// Money fields are optional: the server strips them for view_own-only users.
export interface Summary {
  n: number;
  st: Record<Status, number>;
  grossSales: number;
  newN: number;
  repN: number;
  dN: number;
  rN: number;
  cN: number;
  missing: number;
  est: number;
  lossRate: number;
  net?: number;
  deliveryPaid?: number;
  courierCost?: number;
  cogs?: number;
  packaging?: number;
  fee?: number;
  retLoss?: number;
  contrib?: number;
  subsidy?: number;
  overPos?: number;
  overN?: number;
  margin?: number;
  aov?: number;
}

export interface OrderLine {
  key: string;
  name: string;
  /** Null when the product has no SKU entered. */
  sku?: string | null;
  qty: number;
  price: number;
  disc: number;
  gross: number;
  weight: number;
  unitWeight?: number;
  unitCost?: number | null;
  costOk?: boolean;
  net?: number;
  cogs?: number | null;
}
export interface OrderRow {
  o: {
    id: number;
    orderNumber: string;
    date: string;
    status: Status;
    channel: string;
    agentId: number | null;
    agentName: string | null;
    customer: string;
    phone: string;
    ctype: "New" | "Repeat";
    district: string;
    zone: string;
    payment: string;
    advance: number;
    courier: string | null;
    delivery?: number;
    actual?: number | null;
    hist: {
      confirmed?: string;
      shipped?: string;
      delivered?: string;
      returned?: string;
      cancelled?: string;
    };
  };
  lines: OrderLine[];
  netSales: number;
  weight: number;
  zone: string;
  collect: number;
  shipped: boolean;
  rate?: number | null;
  cod?: number;
  expected?: number | null;
  courierCharge?: number | null;
  estimated?: boolean;
  overcharge?: number | null;
  cogs?: number | null;
  packaging?: number;
  fee?: number;
  contribution?: number | null;
  subsidy?: number | null;
  receivable?: number | null;
  unconfirmed?: boolean;
  flags: FlagKey[];
}
export interface DayPoint {
  date: string;
  net?: number;
  grossSales: number;
  contrib?: number;
}
export interface FilterOptions {
  channels: string[];
  agents: { id: number | null; name: string }[];
  couriers: string[];
  districts: string[];
}
export interface OverviewResponse {
  summary: Summary;
  channels: { channel: string; s: Summary }[];
  daily: DayPoint[];
  options: FilterOptions;
}
export interface OrdersResponse {
  total: number;
  page: number;
  pageSize: number;
  rows: OrderRow[];
}
export interface AgentRow {
  agentId: number | null;
  agentName: string | null;
  s: Summary;
  rankSales: number;
  rankContrib: number;
}
export interface ProductRow {
  key: string;
  name: string;
  sku?: string | null;
  units: number;
  net: number;
  cogs: number;
  subsidy: number;
  other: number;
  ret: number;
  contrib: number;
  costStatus: "confirmed" | "unconfirmed" | "missing";
}
export interface CourierRow {
  courier: string | null;
  n: number;
  ret: number;
  agreed: number;
  billed: number;
  over: number;
  under: number;
  overN: number;
  awaiting: number;
  awaitingAmt: number;
  collect: number;
  recv: number;
}
export interface DistrictRow {
  district: string;
  zone: string;
  s: Summary;
}
export interface ExceptionsResponse {
  total: number;
  groups: { flag: FlagKey; rows: OrderRow[] }[];
}
export interface ZoneRate {
  smallMax: number;
  small: number;
  first: number;
  extra: number;
}
export interface CourierRate {
  cod: number;
  codBase: "product" | "collect";
  returnPct: number;
  zones: Record<string, ZoneRate>;
}
export interface ReportSettings {
  rates: Record<string, CourierRate>;
  packaging: number;
  fees: Record<string, number>;
  th: { low: number; over: number; pending: number; bill: number };
}
export interface SettingsResponse {
  settings: ReportSettings;
  couriers: string[];
  zones: string[];
  canEdit: boolean;
}
export interface CostHistoryRow {
  id: number;
  productId: number;
  variantId: number | null;
  cost: string;
  costPriceUnit: string | null;
  effectiveFrom: string;
  confirmed: boolean;
  createdAt: string;
}
export interface BillImportResult {
  rows: number;
  matched: number;
  updated: number;
  unmatched: string[];
}

const BASE = "/admin/net-profit/sales-report/v2";
const KEY = ["sales-report-v2"];

export function reportParams(
  f: ReportFilters,
  extra: Record<string, string | number | undefined> = {},
) {
  const p = new URLSearchParams();
  const all: Record<string, string | number | undefined> = { ...f, ...extra };
  for (const [k, v] of Object.entries(all))
    if (v !== undefined && v !== "" && v !== "all") p.set(k, String(v));
  return p.toString();
}

function useTab<T>(
  tab: string,
  f: ReportFilters,
  extra: Record<string, string | number | undefined> = {},
  enabled = true,
) {
  return useQuery({
    queryKey: [...KEY, tab, f, extra],
    queryFn: () => proxyFetch<T>(`${BASE}/${tab}?${reportParams(f, extra)}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export const useReportOverview = (f: ReportFilters) =>
  useTab<OverviewResponse>("overview", f);
export const useReportOrders = (
  f: ReportFilters,
  extra: { q?: string; sort?: string; page?: number },
) => useTab<OrdersResponse>("orders", f, extra);
export const useReportAgents = (f: ReportFilters) =>
  useTab<{ rows: AgentRow[] }>("agents", f);
export const useReportProducts = (f: ReportFilters) =>
  useTab<{ rows: ProductRow[] }>("products", f);
export const useReportCouriers = (f: ReportFilters) =>
  useTab<{ rows: CourierRow[]; top: OrderRow[] }>("couriers", f);
export const useReportDistricts = (f: ReportFilters) =>
  useTab<{ rows: DistrictRow[] }>("districts", f);
export const useReportExceptions = (f: ReportFilters) =>
  useTab<ExceptionsResponse>("exceptions", f);

export function useReportSettings(enabled = true) {
  return useQuery({
    queryKey: [...KEY, "settings"],
    queryFn: () => proxyFetch<SettingsResponse>(`${BASE}/settings`),
    enabled,
  });
}

/** Every order matching the filters, unpaged — for the Export CSV. */
export function fetchAllOrders(f: ReportFilters) {
  return proxyFetch<OrdersResponse>(
    `${BASE}/orders?${reportParams(f, { all: "true" })}`,
  );
}

export function useSaveReportSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: ReportSettings) =>
      proxyFetch<SettingsResponse>(`${BASE}/settings`, {
        method: "PUT",
        body: JSON.stringify(s),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCostHistory(productId: number | null) {
  return useQuery({
    queryKey: [...KEY, "costs", productId],
    queryFn: () =>
      proxyFetch<CostHistoryRow[]>(`${BASE}/costs?productId=${productId}`),
    enabled: productId !== null,
  });
}

function useCostMutation<I>(fn: (i: I) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export const useAddCost = () =>
  useCostMutation(
    (i: {
      productId: number;
      variantId?: number | null;
      cost: number;
      effectiveFrom: string;
      costPriceUnit?: string | null;
    }) =>
      proxyFetch(`${BASE}/costs`, { method: "POST", body: JSON.stringify(i) }),
  );
export const useConfirmCost = () =>
  useCostMutation((i: { id: number; confirmed: boolean }) =>
    proxyFetch(`${BASE}/costs/${i.id}`, {
      method: "PATCH",
      body: JSON.stringify({ confirmed: i.confirmed }),
    }),
  );
export const useRemoveCost = () =>
  useCostMutation((id: number) =>
    proxyFetch(`${BASE}/costs/${id}`, { method: "DELETE" }),
  );

/** Multipart goes through the dedicated Next route, not proxyFetch. */
export async function importCourierBill(
  provider: string,
  file: File,
): Promise<BillImportResult> {
  const fd = new FormData();
  fd.set("provider", provider);
  fd.set("file", file);
  const res = await fetch(`/api/backend${BASE}/courier-bills`, {
    method: "POST",
    body: fd,
  });
  const json = await res.json();
  if (!res.ok || !json.success)
    throw new Error(json?.error?.message ?? "Import failed");
  return json.data as BillImportResult;
}
