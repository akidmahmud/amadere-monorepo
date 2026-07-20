import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export interface Expense {
  id: number;
  expenseDate: string;
  category: string;
  amount: string;
  isVatInput: boolean;
  note: string | null;
  createdAt: string;
}

export type DuePartyType = "CUSTOMER" | "SUPPLIER";
export type DueStatus = "PENDING" | "PARTIALLY_PAID" | "PAID";

export interface Due {
  id: number;
  partyType: DuePartyType;
  partyName: string;
  customerId: number | null;
  amount: string;
  paidAmount: string;
  remaining: string;
  status: DueStatus;
  dueDate: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VatSettings {
  enabled: boolean;
  ratePercent: number;
  binNumber: string;
}

export interface VatSummary {
  outputVat: string;
  inputVat: string;
  netPayable: string;
  revenue: string;
  ratePercent: number;
}

export interface CashFlowEntry {
  date: string;
  type: "SALE" | "DUE_RECEIVED" | "EXPENSE" | "DUE_PAID" | "REFUND";
  description: string;
  amount: string;
}

export interface CashFlowSummary {
  cashIn: string;
  cashOut: string;
  net: string;
  entries: CashFlowEntry[];
}

export interface AccountsOverview {
  revenue: string;
  totalExpenses: string;
  vatPayable: string;
  netCashFlow: string;
  customerDueOutstanding: string;
  supplierDueOutstanding: string;
}

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DateRange {
  from?: string;
  to?: string;
}

const KEY = ["net-profit-accounts"];

function toQueryString(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function useAccountsOverview(range: DateRange) {
  return useQuery({
    queryKey: [...KEY, "overview", range],
    queryFn: () => proxyFetch<AccountsOverview>(`/admin/net-profit/accounts/overview${toQueryString(range)}`),
  });
}

export function useExpenses(range: DateRange & { page?: number; pageSize?: number; category?: string }) {
  return useQuery({
    queryKey: [...KEY, "expenses", range],
    queryFn: () => proxyFetch<Paginated<Expense>>(`/admin/net-profit/accounts/expenses${toQueryString(range)}`),
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { expenseDate: string; category: string; amount: number; isVatInput?: boolean; note?: string }) =>
      proxyFetch<Expense>("/admin/net-profit/accounts/expenses", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch(`/admin/net-profit/accounts/expenses/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDues(filters: { partyType?: DuePartyType; status?: DueStatus; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: [...KEY, "dues", filters],
    queryFn: () => proxyFetch<Paginated<Due>>(`/admin/net-profit/accounts/dues${toQueryString(filters)}`),
  });
}

export function useCreateDue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { partyType: DuePartyType; partyName: string; customerId?: number; amount: number; dueDate?: string; note?: string }) =>
      proxyFetch<Due>("/admin/net-profit/accounts/dues", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRecordDuePayment(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) =>
      proxyFetch<Due>(`/admin/net-profit/accounts/dues/${id}/payments`, { method: "POST", body: JSON.stringify({ amount }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteDue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch(`/admin/net-profit/accounts/dues/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useVatSettings() {
  return useQuery({
    queryKey: [...KEY, "vat-settings"],
    queryFn: () => proxyFetch<VatSettings>("/admin/net-profit/accounts/vat-settings"),
  });
}

export function useUpdateVatSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<VatSettings>) =>
      proxyFetch<VatSettings>("/admin/net-profit/accounts/vat-settings", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useVatSummary(range: DateRange) {
  return useQuery({
    queryKey: [...KEY, "vat-summary", range],
    queryFn: () => proxyFetch<VatSummary>(`/admin/net-profit/accounts/vat-summary${toQueryString(range)}`),
  });
}

export function useCashFlow(range: DateRange) {
  return useQuery({
    queryKey: [...KEY, "cash-flow", range],
    queryFn: () => proxyFetch<CashFlowSummary>(`/admin/net-profit/accounts/cash-flow${toQueryString(range)}`),
  });
}

export function accountsExportUrl(kind: "expenses" | "dues" | "cashflow", range: DateRange): string {
  return `/api/backend/admin/net-profit/accounts/export/${kind}${toQueryString(range)}`;
}
