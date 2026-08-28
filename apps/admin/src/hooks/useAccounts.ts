import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

// Types mirror the backend DTOs. All money is a 2dp decimal string, never a
// number — the API never sends floats for money and neither should this.

export type PartyType = "PERSON" | "COMPANY";
export type PartyRole =
  "SUPPLIER" | "CUSTOMER" | "COURIER" | "STAFF" | "GOVERNMENT" | "OTHER";
export type CourierProvider = "STEADFAST" | "PATHAO" | "REDX" | "ECOURIER";
export type CashAccountType = "CASH" | "BANK" | "MOBILE_WALLET";
export type DueKind = "RECEIVABLE" | "PAYABLE";
export type DueStatus = "PENDING" | "PARTIALLY_PAID" | "PAID";
export type DueSource =
  | "MANUAL"
  | "EXPENSE"
  | "ORDER"
  | "COD_IN_TRANSIT"
  | "OPENING"
  | "WHOLESALE_INVOICE";
export type ExpensePaymentStatus = "PAID" | "PARTIAL" | "UNPAID";
export type AgeingBucket = "CURRENT" | "1_30" | "31_60" | "60_PLUS";

export interface Party {
  id: number;
  name: string;
  type: PartyType;
  roles: PartyRole[];
  phone: string | null;
  email: string | null;
  address: string | null;
  bin: string | null;
  tin: string | null;
  customerId: number | null;
  courierProvider: CourierProvider | null;
  creditLimit: string | null;
  creditDays: number | null;
  receivable: string;
  payable: string;
  net: string;
  note: string | null;
  isActive: boolean;
}

export interface PartyStatement {
  party: Party;
  entries: {
    id: number;
    entryDate: string;
    direction: "IN" | "OUT";
    amount: string;
    source: string;
    reference: string | null;
    note: string | null;
  }[];
  dues: {
    id: number;
    docNo: string;
    kind: DueKind;
    amount: string;
    issueDate: string;
    dueDate: string | null;
    source: DueSource;
  }[];
  position: { receivable: string; payable: string; net: string };
}

export interface CashAccount {
  id: number;
  name: string;
  type: CashAccountType;
  accountNumber: string | null;
  openingBalance: string;
  openingDate: string;
  balance: string;
  isActive: boolean;
  sortOrder: number;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  isVatClaimable: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface CostCentre {
  id: number;
  name: string;
  code: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface PeriodLock {
  id: number;
  month: string;
  lockedAt: string;
  lockedBy: number | null;
  note: string | null;
}

export interface Expense {
  id: number;
  voucherNo: string;
  expenseDate: string;
  categoryId: number;
  categoryName: string;
  costCentreId: number | null;
  costCentreName: string | null;
  partyId: number;
  partyName: string;
  netAmount: string;
  vatRate: string;
  vatAmount: string;
  grossAmount: string;
  amountIncludesVat: boolean;
  mushakChallanNo: string | null;
  aitAmount: string;
  vdsAmount: string;
  netPayable: string;
  paidAmount: string;
  remaining: string;
  paymentStatus: ExpensePaymentStatus;
  dueDate: string | null;
  attachmentUrl: string | null;
  note: string | null;
  voidedAt: string | null;
}

export interface Due {
  id: number;
  docNo: string;
  kind: DueKind;
  partyId: number;
  partyName: string;
  source: DueSource;
  amount: string;
  paidAmount: string;
  remaining: string;
  status: DueStatus;
  issueDate: string;
  dueDate: string | null;
  ageDays: number;
  bucket: AgeingBucket;
  expenseId: number | null;
  orderId: number | null;
  note: string | null;
  voidedAt: string | null;
}

export interface AgeingReport {
  kind: DueKind;
  buckets: Record<AgeingBucket, { count: number; amount: string }>;
  total: string;
  overdue: string;
  averageAgeDays: number;
}

export interface PendingCodBatch {
  provider: CourierProvider;
  partyId: number | null;
  partyName: string | null;
  shipmentCount: number;
  codCollected: string;
  courierCharges: string;
  expected: string;
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
  lines: { label: string; amount: string }[];
}

export interface VatRiskRow {
  expenseId: number;
  voucherNo: string;
  partyName: string;
  partyBin: string | null;
  expenseDate: string;
  vatAmount: string;
  reason: "NO_CHALLAN" | "NO_SUPPLIER_BIN";
}

export interface AccountsAlert {
  severity: "INFO" | "WARN" | "DANGER";
  message: string;
}

export interface AccountsOverview {
  sales: string;
  expenses: string;
  receivable: string;
  payable: string;
  cashInHand: string;
  codWithCourier: string;
  spendByCategory: { category: string; amount: string }[];
  alerts: AccountsAlert[];
}

export interface CashFlowRow {
  accountId: number;
  name: string;
  type: CashAccountType;
  opening: string;
  moneyIn: string;
  moneyOut: string;
  closing: string;
}

export interface VatSettings {
  enabled: boolean;
  ratePercent: number;
  binNumber: string;
}

export interface CodFeeSettings {
  enabled: boolean;
  percent: number;
}

export interface PostingSettings {
  defaultCashAccountId: number | null;
}

export interface Paginated<T> {
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
const BASE = "/admin/net-profit/accounts";

function toQueryString(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/** Every mutation invalidates the whole module: balances, ageing and the
 *  overview are all derived from the ledger, so almost any write moves them. */
function useAccountsMutation<TInput, TResult>(
  fn: (input: TInput) => Promise<TResult>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// --- Parties ---------------------------------------------------------------

export interface PartyFilters {
  q?: string;
  role?: PartyRole;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export function useParties(filters: PartyFilters = {}) {
  return useQuery({
    queryKey: [...KEY, "parties", filters],
    queryFn: () =>
      proxyFetch<Paginated<Party>>(`${BASE}/parties${toQueryString(filters)}`),
  });
}

export function usePartyStatement(id: number | null, range: DateRange = {}) {
  return useQuery({
    queryKey: [...KEY, "party-statement", id, range],
    enabled: id !== null,
    queryFn: () =>
      proxyFetch<PartyStatement>(
        `${BASE}/parties/${id}/statement${toQueryString(range)}`,
      ),
  });
}

export type PartyInput = Partial<
  Omit<Party, "id" | "receivable" | "payable" | "net">
> & {
  name: string;
  type: PartyType;
  roles: PartyRole[];
};

export function useCreateParty() {
  return useAccountsMutation((input: PartyInput) =>
    proxyFetch<Party>(`${BASE}/parties`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}

export function useUpdateParty() {
  return useAccountsMutation(
    ({ id, ...input }: Partial<PartyInput> & { id: number }) =>
      proxyFetch<Party>(`${BASE}/parties/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
  );
}

export function useDeleteParty() {
  return useAccountsMutation((id: number) =>
    proxyFetch<{ id: number }>(`${BASE}/parties/${id}`, { method: "DELETE" }),
  );
}

// --- Cash accounts ---------------------------------------------------------

export function useCashAccounts() {
  return useQuery({
    queryKey: [...KEY, "cash-accounts"],
    queryFn: () => proxyFetch<CashAccount[]>(`${BASE}/cash-accounts`),
  });
}

export interface CashAccountInput {
  name: string;
  type: CashAccountType;
  accountNumber?: string;
  openingBalance?: string;
  openingDate: string;
  isActive?: boolean;
  sortOrder?: number;
}

export function useCreateCashAccount() {
  return useAccountsMutation((input: CashAccountInput) =>
    proxyFetch<CashAccount>(`${BASE}/cash-accounts`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}

export function useUpdateCashAccount() {
  return useAccountsMutation(
    ({ id, ...input }: Partial<CashAccountInput> & { id: number }) =>
      proxyFetch<CashAccount>(`${BASE}/cash-accounts/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
  );
}

export function useTransfer() {
  return useAccountsMutation(
    (input: {
      fromAccountId: number;
      toAccountId: number;
      amount: string;
      transferDate: string;
      reference?: string;
      note?: string;
    }) =>
      proxyFetch(`${BASE}/cash-accounts/transfers`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
  );
}

// --- Master data -----------------------------------------------------------

export function useExpenseCategories() {
  return useQuery({
    queryKey: [...KEY, "expense-categories"],
    queryFn: () =>
      proxyFetch<ExpenseCategory[]>(`${BASE}/masters/expense-categories`),
  });
}

export function useCostCentres() {
  return useQuery({
    queryKey: [...KEY, "cost-centres"],
    queryFn: () => proxyFetch<CostCentre[]>(`${BASE}/masters/cost-centres`),
  });
}

export function usePeriodLocks() {
  return useQuery({
    queryKey: [...KEY, "period-locks"],
    queryFn: () => proxyFetch<PeriodLock[]>(`${BASE}/masters/period-locks`),
  });
}

export function useLockPeriod() {
  return useAccountsMutation((input: { month: string; note?: string }) =>
    proxyFetch<PeriodLock>(`${BASE}/masters/period-locks`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}

export function useUnlockPeriod() {
  return useAccountsMutation((month: string) =>
    proxyFetch(`${BASE}/masters/period-locks/${month}`, { method: "DELETE" }),
  );
}

// --- Expenses --------------------------------------------------------------

export interface ExpenseFilters extends DateRange {
  categoryId?: number;
  costCentreId?: number;
  partyId?: number;
  paymentStatus?: ExpensePaymentStatus;
  q?: string;
  page?: number;
  pageSize?: number;
}

export function useExpenses(filters: ExpenseFilters = {}) {
  return useQuery({
    queryKey: [...KEY, "expenses", filters],
    queryFn: () =>
      proxyFetch<Paginated<Expense>>(
        `${BASE}/expenses${toQueryString(filters)}`,
      ),
  });
}

export interface ExpenseInput {
  expenseDate: string;
  categoryId: number;
  costCentreId?: number;
  partyId: number;
  amount: string;
  amountIncludesVat?: boolean;
  vatRate?: string;
  mushakChallanNo?: string;
  aitPercent?: string;
  vdsPercent?: string;
  paymentStatus: "paid" | "due" | "partial";
  paidNow?: string;
  paidFromAccountId?: number;
  dueDate?: string;
  note?: string;
}

export function useCreateExpense() {
  return useAccountsMutation((input: ExpenseInput) =>
    proxyFetch<Expense>(`${BASE}/expenses`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}

/** Void, not delete — the voucher and its reversing ledger entries stay. */
export function useVoidExpense() {
  return useAccountsMutation((id: number) =>
    proxyFetch<Expense>(`${BASE}/expenses/${id}/void`, { method: "POST" }),
  );
}

export function useRecordExpensePayment() {
  return useAccountsMutation(
    ({ id, ...input }: PaymentInput & { id: number }) =>
      proxyFetch<Expense>(`${BASE}/expenses/${id}/payments`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
  );
}

// --- Dues ------------------------------------------------------------------

export interface DueFilters extends DateRange {
  kind?: DueKind;
  partyId?: number;
  source?: DueSource;
  status?: DueStatus;
  q?: string;
  page?: number;
  pageSize?: number;
}

export function useDues(filters: DueFilters = {}) {
  return useQuery({
    queryKey: [...KEY, "dues", filters],
    queryFn: () =>
      proxyFetch<Paginated<Due>>(`${BASE}/dues${toQueryString(filters)}`),
  });
}

export function useAgeing(kind: DueKind) {
  return useQuery({
    queryKey: [...KEY, "ageing", kind],
    queryFn: () => proxyFetch<AgeingReport>(`${BASE}/dues/ageing?kind=${kind}`),
  });
}

export function useCreateDue() {
  return useAccountsMutation(
    (input: {
      kind: DueKind;
      partyId: number;
      amount: string;
      issueDate: string;
      dueDate?: string;
      note?: string;
    }) =>
      proxyFetch<Due>(`${BASE}/dues`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
  );
}

/** The account and date are required: a payment that does not say which
 *  account it came from cannot move a balance. */
export interface PaymentInput {
  amount: string;
  paymentDate: string;
  accountId: number;
  reference?: string;
  note?: string;
}

export function useRecordDuePayment() {
  return useAccountsMutation(
    ({ id, ...input }: PaymentInput & { id: number }) =>
      proxyFetch<Due>(`${BASE}/dues/${id}/payments`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
  );
}

export function useVoidDue() {
  return useAccountsMutation((id: number) =>
    proxyFetch<Due>(`${BASE}/dues/${id}/void`, { method: "POST" }),
  );
}

// --- COD settlement --------------------------------------------------------

export function usePendingCod() {
  return useQuery({
    queryKey: [...KEY, "cod-pending"],
    queryFn: () => proxyFetch<PendingCodBatch[]>(`${BASE}/cod/pending`),
  });
}

export function useSettleCod() {
  return useAccountsMutation(
    (input: {
      provider: CourierProvider;
      settlementDate: string;
      netPayout: string;
      accountId: number;
      reference?: string;
      note?: string;
    }) =>
      proxyFetch<{ id: number; adjustment: string }>(
        `${BASE}/cod/settlements`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
  );
}

// --- VAT -------------------------------------------------------------------

export function useVatReturn(range: DateRange) {
  return useQuery({
    queryKey: [...KEY, "vat-return", range],
    queryFn: () =>
      proxyFetch<VatReturn>(`${BASE}/vat/return${toQueryString(range)}`),
  });
}

export function useVatAtRisk(range: DateRange) {
  return useQuery({
    queryKey: [...KEY, "vat-at-risk", range],
    queryFn: () =>
      proxyFetch<VatRiskRow[]>(`${BASE}/vat/at-risk${toQueryString(range)}`),
  });
}

export interface VatExceptionRow {
  productId: number;
  name: string;
  slug: string;
  sku: string | null;
  /** Percent as a string. "0.00" is a real value: explicitly zero-rated. */
  ratePercent: string;
}

export function useVatExceptions() {
  return useQuery({
    queryKey: [...KEY, "vat-exceptions"],
    queryFn: () => proxyFetch<VatExceptionRow[]>(`${BASE}/vat/exceptions`),
  });
}

export function useSetVatException() {
  const qc = useQueryClient();
  return useMutation({
    // ratePercent null removes the exception (back to the store rate), which
    // is not the same as 0 (explicitly zero-rated).
    mutationFn: ({ productId, ratePercent }: { productId: number; ratePercent: number | null }) =>
      proxyFetch<VatExceptionRow[]>(`${BASE}/vat/exceptions/${productId}`, {
        method: "PUT",
        body: JSON.stringify({ ratePercent }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, "vat-exceptions"] });
      // The VAT return is computed from these rates, so it is now stale.
      qc.invalidateQueries({ queryKey: [...KEY, "vat-return"] });
    },
  });
}

// --- Reports ---------------------------------------------------------------

export function useAccountsOverview(range: DateRange) {
  return useQuery({
    queryKey: [...KEY, "overview", range],
    queryFn: () =>
      proxyFetch<AccountsOverview>(
        `${BASE}/reports/overview${toQueryString(range)}`,
      ),
  });
}

export function useCashFlowByAccount(range: DateRange) {
  return useQuery({
    queryKey: [...KEY, "cash-flow", range],
    queryFn: () =>
      proxyFetch<CashFlowRow[]>(
        `${BASE}/reports/cash-flow${toQueryString(range)}`,
      ),
  });
}

/**
 * The caller passes the same filter object driving the table, so the file and
 * the screen can never disagree.
 */
export function accountsExportUrl(
  kind: "expenses" | "dues" | "cashflow" | "ledger",
  filters: object = {},
): string {
  return `/api/backend${BASE}/reports/export/${kind}${toQueryString(filters)}`;
}

// --- Settings --------------------------------------------------------------

export function useVatSettings() {
  return useQuery({
    queryKey: [...KEY, "vat-settings"],
    queryFn: () => proxyFetch<VatSettings>(`${BASE}/vat-settings`),
  });
}

export function useUpdateVatSettings() {
  return useAccountsMutation((input: Partial<VatSettings>) =>
    proxyFetch<VatSettings>(`${BASE}/vat-settings`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  );
}

export function useCodFeeSettings() {
  return useQuery({
    queryKey: [...KEY, "cod-fee-settings"],
    queryFn: () => proxyFetch<CodFeeSettings>(`${BASE}/cod-fee-settings`),
  });
}

export function useUpdateCodFeeSettings() {
  return useAccountsMutation((input: Partial<CodFeeSettings>) =>
    proxyFetch<CodFeeSettings>(`${BASE}/cod-fee-settings`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  );
}

export function usePostingSettings() {
  return useQuery({
    queryKey: [...KEY, "posting-settings"],
    queryFn: () => proxyFetch<PostingSettings>(`${BASE}/posting-settings`),
  });
}

export function useUpdatePostingSettings() {
  return useAccountsMutation((input: Partial<PostingSettings>) =>
    proxyFetch<PostingSettings>(`${BASE}/posting-settings`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  );
}
