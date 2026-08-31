import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export interface CartSnapshotItem {
  productId: number;
  name: string;
  slug: string;
  quantity: number;
  unitPrice: string;
  imageUrl: string | null;
}

/** Stages a shopper can be abandoned at, most-advanced last. */
export const ABANDONMENT_STAGES = [
  { value: "cart", label: "Cart abandonment" },
  { value: "checkout", label: "Checkout abandonment" },
  { value: "otp", label: "OTP abandonment" },
] as const;

export const STAGE_LABELS: Record<string, string> = {
  cart: "Cart abandonment",
  checkout: "Checkout abandonment",
  otp: "OTP abandonment",
  payment: "Payment abandonment",
};

export interface IncompleteOrder {
  id: number;
  customerId: number | null;
  /** Typed at checkout — for a guest this is the only name there is. */
  name: string | null;
  phone: string | null;
  email: string | null;
  /** Partial shipping address typed before abandoning; pre-fills Create order. */
  address: Record<string, string | undefined> | null;
  cart: CartSnapshotItem[];
  subtotal: string;
  stage: string;
  recovered: boolean;
  /** Set once binned. Null for a live cart. */
  deletedAt?: string | null;
  /** Days left before the nightly purge removes it for good. */
  daysRemaining?: number | null;
  recoveredOrderId: number | null;
  /** Staff gave up on this cart. Canceled iff this is non-null. */
  canceledAt: string | null;
  cancelReason: string | null;
  recoveryAttempts: number;
  lastSeenAt: string;
  createdAt: string;
}

export interface RecoveryRate {
  total: number;
  recovered: number;
  ratePercent: number;
  recoveredValue: string;
}

export interface RecoverySettings {
  enabled: boolean;
  delayHours: number;
  maxAttempts: number;
  quietHoursStart: number;
  quietHoursEnd: number;
}

export type RecoveryOutcome = "open" | "recovered" | "cancelled" | "all";

export interface RecoveryFilters {
  /** Omitted = the API's default, which is "open". */
  outcome?: RecoveryOutcome;
  recovered?: boolean;
  /** "cart" | "checkout" | "otp" | "payment" */
  stage?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

// Mirrors CheckoutAddressDto, in the storefront checkout's field order.
// `division` is gone: the backend derives it from `district` (every BD
// district belongs to exactly one), and asking staff for it here made the
// recovery form ask for something the checkout page never collected.
export interface CreateOrderInput {
  recipientName: string;
  phone: string;
  addressLine: string;
  district: string;
  area: string;
  landmark?: string;
  alternativePhone?: string;
  email?: string;
}

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const LIST_KEY = ["net-profit-recovery"];
const RATE_KEY = ["net-profit-recovery-rate"];
const SETTINGS_KEY = ["net-profit-recovery-settings"];

function toQueryString(filters: RecoveryFilters): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function useIncompleteOrders(filters: RecoveryFilters = {}) {
  return useQuery({
    queryKey: [...LIST_KEY, filters],
    queryFn: () =>
      proxyFetch<Paginated<IncompleteOrder>>(
        `/admin/net-profit/recovery${toQueryString(filters)}`,
      ),
    // Paging changes the key, and without this the table empties to a spinner
    // on every page change instead of swapping rows underneath.
    placeholderData: keepPreviousData,
  });
}

export function useRecoveryRate() {
  return useQuery({
    queryKey: RATE_KEY,
    queryFn: () => proxyFetch<RecoveryRate>("/admin/net-profit/recovery/rate"),
  });
}

export function useSendRecovery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      proxyFetch(`/admin/net-profit/recovery/${id}/send`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

/**
 * Bin a cart. Soft — it leaves every working list at once and is restorable
 * for 30 days, after which the nightly purge removes it. This replaced the
 * old cancel action; a reason is optional and editable afterwards from the
 * trash tab.
 */
export function useDeleteIncompleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      proxyFetch<IncompleteOrder>(
        `/admin/net-profit/recovery/${id}${reason ? `?reason=${encodeURIComponent(reason)}` : ""}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: RATE_KEY });
      qc.invalidateQueries({ queryKey: TRASH_KEY });
    },
  });
}

const TRASH_KEY = ["recovery-trash"];

export function useDeletedCarts(page: number, pageSize: number, q: string) {
  return useQuery({
    queryKey: [...TRASH_KEY, page, pageSize, q],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (q.trim()) params.set("q", q.trim());
      return proxyFetch<{ items: IncompleteOrder[]; total: number }>(
        `/admin/net-profit/recovery/trash?${params}`,
      );
    },
  });
}

export function useRestoreIncompleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      proxyFetch<IncompleteOrder>(`/admin/net-profit/recovery/${id}/restore`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: RATE_KEY });
      qc.invalidateQueries({ queryKey: TRASH_KEY });
    },
  });
}

/** Inline edit of the reason cell. Blank clears it. */
export function useUpdateCartReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      proxyFetch<IncompleteOrder>(`/admin/net-profit/recovery/${id}/reason`, {
        method: "PATCH",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TRASH_KEY });
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useClearAllIncomplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recovered?: boolean) =>
      proxyFetch<{ count: number }>(
        `/admin/net-profit/recovery/clear${recovered !== undefined ? `?recovered=${recovered}` : ""}`,
        {
          method: "POST",
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: RATE_KEY });
    },
  });
}

export function useCancelIncompleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      proxyFetch<IncompleteOrder>(`/admin/net-profit/recovery/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useCreateOrderFromIncomplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: CreateOrderInput & { id: number }) =>
      proxyFetch<{ orderId: number; orderNumber: string }>(
        `/admin/net-profit/recovery/${id}/create-order`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: RATE_KEY });
    },
  });
}

export function useImportRecoveryCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/backend/admin/net-profit/recovery/import", {
        method: "POST",
        body: form,
      });
      const body = await res.json();
      if (!body.success)
        throw new Error(body.error?.message ?? "Import failed");
      return body.data as { imported: number; skipped: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function recoveryExportUrl(filters: RecoveryFilters = {}): string {
  return `/api/backend/admin/net-profit/recovery/export${toQueryString(filters)}`;
}

export function useRecoverySettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () =>
      proxyFetch<RecoverySettings>("/admin/net-profit/recovery/settings"),
  });
}

export function useUpdateRecoverySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<RecoverySettings>) =>
      proxyFetch<RecoverySettings>("/admin/net-profit/recovery/settings", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}
