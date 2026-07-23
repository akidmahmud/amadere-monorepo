import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type AdminCustomer = components["schemas"]["AdminCustomerDto"];
export type AdminCustomerListItem = components["schemas"]["AdminCustomerListItemDto"];
export type CustomerTier = components["schemas"]["CustomerTierDto"];
export type CustomerTierCount = components["schemas"]["CustomerTierCountDto"];
export type CustomerNote = components["schemas"]["AdminCustomerNoteDto"];
export type CustomerCallLog = components["schemas"]["AdminCustomerCallLogDto"];
export type AssignableStaff = { id: number; name: string };

export type CustomerPriority = "HIGH" | "MEDIUM" | "LOW";
export type CustomerCrmStatus = "NOT_STARTED" | "IN_PROGRESS" | "FOLLOW_UP" | "DONE";
export type CustomerBehaviour = "LOYAL" | "PRICE_SENSITIVE" | "OCCASIONAL";

export interface CustomerListFilters {
  q?: string;
  tierId?: number;
  district?: string;
  priority?: CustomerPriority;
  crmStatus?: CustomerCrmStatus;
  assignedAdminId?: number;
  birthdayToday?: boolean;
  page?: number;
  pageSize?: number;
}

// Every field the CRM table's cells can PATCH inline — one at a time, same
// pattern as the rest of the admin (e.g. ProductsTable's variant stock).
export interface UpdateCustomerInput {
  firstName?: string;
  lastName?: string;
  dob?: string | null;
  isFavorite?: boolean;
  assignedAdminId?: number | null;
  nextCallTarget?: string | null;
  followUpCadenceDays?: number | null;
  hasNewOrder?: boolean;
  newOrderAt?: string | null;
  priority?: CustomerPriority | null;
  crmStatus?: CustomerCrmStatus | null;
  behaviour?: CustomerBehaviour | null;
  customerFeedback?: string;
  amaderFeedback?: string;
  familyDetails?: string;
  purchaseReason?: string;
  facebookProfileUrl?: string;
}

const LIST_KEY = ["customers"];
const TIERS_KEY = ["customer-tiers"];

function toQueryString(filters: CustomerListFilters): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function useCustomers(filters: CustomerListFilters = {}) {
  return useQuery({
    queryKey: [...LIST_KEY, filters],
    queryFn: () =>
      proxyFetch<{ items: AdminCustomerListItem[]; total: number }>(`/admin/customers${toQueryString(filters)}`),
    placeholderData: keepPreviousData,
  });
}

export type CustomerStats = components["schemas"]["AdminCustomerStatsDto"];

export function useCustomerStats() {
  return useQuery({
    queryKey: [...LIST_KEY, "stats"],
    queryFn: () => proxyFetch<CustomerStats>("/admin/customers/stats"),
  });
}

export function useCustomer(id: number) {
  return useQuery({
    queryKey: [...LIST_KEY, id],
    queryFn: () => proxyFetch<AdminCustomer>(`/admin/customers/${id}`),
    enabled: Number.isFinite(id),
  });
}

export function useUpdateCustomer(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCustomerInput) =>
      proxyFetch<AdminCustomer>(`/admin/customers/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: (data) => {
      qc.setQueryData([...LIST_KEY, id], data);
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useAssignableStaff() {
  return useQuery({
    queryKey: [...LIST_KEY, "assignable-staff"],
    queryFn: () => proxyFetch<AssignableStaff[]>("/admin/customers/assignable-staff"),
  });
}

export function useAddCustomerNote(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { type: string; body: string }) =>
      proxyFetch<CustomerNote>(`/admin/customers/${id}/notes`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...LIST_KEY, id] }),
  });
}

export function useLogCustomerCall(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { outcome: string; notes?: string }) =>
      proxyFetch<CustomerCallLog>(`/admin/customers/${id}/calls`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...LIST_KEY, id] }),
  });
}

export function useDialCustomer(id: number) {
  return useMutation({
    mutationFn: () => proxyFetch<{ providerCallId: string }>(`/admin/customers/${id}/calls/dial`, { method: "POST" }),
  });
}

export function useCustomerTiers() {
  return useQuery({
    queryKey: TIERS_KEY,
    queryFn: () => proxyFetch<CustomerTier[]>("/admin/customer-tiers"),
  });
}

export function useCustomerTierCounts() {
  return useQuery({
    queryKey: [...TIERS_KEY, "counts"],
    queryFn: () => proxyFetch<CustomerTierCount[]>("/admin/customer-tiers/counts"),
  });
}

export function useUpdateCustomerTiers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tiers: { label: string; minCompletedOrders: number; sortOrder: number }[]) =>
      proxyFetch<CustomerTier[]>("/admin/customer-tiers", { method: "PUT", body: JSON.stringify({ tiers }) }),
    onSuccess: (data) => {
      qc.setQueryData(TIERS_KEY, data);
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: [...TIERS_KEY, "counts"] });
    },
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { phone: string; firstName?: string; lastName?: string; email?: string }) =>
      proxyFetch<AdminCustomer>("/admin/customers", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}
