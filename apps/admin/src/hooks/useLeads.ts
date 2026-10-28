import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

// Typed here (not from the generated schema): mirrors the backend's leads
// module (apps/backend/src/modules/leads).
export type LeadStatus = "NEW" | "CONTACTED" | "INTERESTED" | "FOLLOW_UP" | "CONVERTED" | "LOST" | "DNC";
export type LeadCallOutcome =
  | "ANSWERED_INTERESTED"
  | "ANSWERED_CALL_BACK"
  | "ANSWERED_REGULAR_BUYER"
  | "ANSWERED_WHOLESALE"
  | "NO_ANSWER"
  | "BUSY"
  | "NUMBER_OFF"
  | "NOT_INTERESTED"
  | "WRONG_NUMBER"
  | "DO_NOT_CALL"
  | "ORDER_PLACED";
export type LeadPriority = "HIGH" | "MEDIUM" | "LOW";

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  INTERESTED: "Interested",
  FOLLOW_UP: "Follow-up",
  CONVERTED: "Converted",
  LOST: "Lost",
  DNC: "Do not call",
};
export const LEAD_OUTCOME_LABEL: Record<LeadCallOutcome, string> = {
  ANSWERED_INTERESTED: "Answered - interested",
  ANSWERED_CALL_BACK: "Answered - call back later",
  ANSWERED_REGULAR_BUYER: "Answered - regular buyer",
  ANSWERED_WHOLESALE: "Answered - wholesale",
  NO_ANSWER: "No answer",
  BUSY: "Busy / cut the call",
  NUMBER_OFF: "Number off",
  NOT_INTERESTED: "Not interested",
  WRONG_NUMBER: "Wrong number",
  DO_NOT_CALL: "Do not call",
  ORDER_PLACED: "Order placed",
};
export const LEAD_SOURCES = ["Inbound call", "WhatsApp", "Facebook", "Messenger", "Instagram", "Website", "Referral", "Other"];
export const LOST_REASONS = ["Price too high", "Not interested", "Wrong number", "Went to competitor", "No response", "Other"];

export interface Lead {
  id: number;
  phone: string;
  name: string | null;
  email: string | null;
  altPhone: string | null;
  addressLine: string | null;
  district: string | null;
  area: string | null;
  leadSource: string | null;
  leadDate: string | null;
  interestedProduct: string | null;
  assignedAdminId: number | null;
  assignedAdminName: string | null;
  priority: LeadPriority | null;
  status: LeadStatus;
  nextCallDate: string | null;
  lastCallAt: string | null;
  lostReason: string | null;
  customerFeedback: string | null;
  agentFeedback: string | null;
  familyDetails: string | null;
  purchaseReason: string | null;
  createdAt: string;
  callCount?: number;
}
export interface LeadCall {
  id: number;
  outcome: LeadCallOutcome;
  notes: string | null;
  authorName: string | null;
  createdAt: string;
}
export type LeadDetail = Lead & { calls: LeadCall[] };
export type LeadInput = Partial<Omit<Lead, "id" | "assignedAdminName" | "createdAt" | "callCount" | "lastCallAt">>;

export interface LeadFilters {
  q?: string;
  status?: LeadStatus | "";
  assigned?: string;
  view?: "due" | "";
  page?: number;
  pageSize?: number;
}

export interface LeadDashboard {
  from: string;
  to: string;
  kpis: {
    newLeads: number;
    firstOrders: number;
    firstOrdersOfCalledPct: number;
    repeatOrders: number;
    orderValue: number;
    calls: number;
    answeredPct: number;
    followUpsDue: number;
    doNotCall: number;
  };
  callsPerDay: { day: string; answered: number; notReached: number }[];
  callOutcomes: { label: string; count: number }[];
  firstOrdersBySource: { label: string; count: number }[];
  lostReasons: { label: string; count: number }[];
  customersByLastOrder: { label: string; count: number }[];
  agentPerformance: {
    agentId: number;
    agent: string;
    openLeads: number;
    callsMade: number;
    answered: number;
    firstOrders: number;
    repeatOrders: number;
    orderValue: number;
    dueNow: number;
  }[];
}

export const LEADS_KEY = ["leads"];

const qs = (o: object) =>
  new URLSearchParams(
    Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && v !== null) as [string, string][],
  ).toString();

export function useLeads(f: LeadFilters) {
  return useQuery({
    queryKey: [...LEADS_KEY, "list", f],
    queryFn: () =>
      proxyFetch<{ items: Lead[]; total: number; page: number; pageSize: number }>(`/admin/leads?${qs(f)}`),
    placeholderData: (prev) => prev,
  });
}

export function useLead(id: number | null) {
  return useQuery({
    queryKey: [...LEADS_KEY, "one", id],
    queryFn: () => proxyFetch<LeadDetail>(`/admin/leads/${id}`),
    enabled: id !== null && id > 0,
  });
}

export function useLeadDashboard(f: { from?: string; to?: string; agentId?: number }) {
  return useQuery({
    queryKey: [...LEADS_KEY, "dashboard", f],
    queryFn: () => proxyFetch<LeadDashboard>(`/admin/leads/dashboard?${qs(f)}`),
  });
}

function useLeadMutation<A>(fn: (a: A) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: LEADS_KEY }) });
}

export const useCreateLead = () =>
  useLeadMutation((input: LeadInput & { phone: string }) =>
    proxyFetch<LeadDetail>("/admin/leads", { method: "POST", body: JSON.stringify(input) }),
  );
export const useUpdateLead = (id: number) =>
  useLeadMutation((input: LeadInput) =>
    proxyFetch<LeadDetail>(`/admin/leads/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  );
export const useDeleteLead = () =>
  useLeadMutation((id: number) => proxyFetch(`/admin/leads/${id}`, { method: "DELETE" }));
export function useDeletedLeads(page: number) {
  return useQuery({
    queryKey: [...LEADS_KEY, "trash", page],
    queryFn: () =>
      proxyFetch<{ items: Lead[]; total: number; page: number; pageSize: number }>(`/admin/leads/trash?page=${page}&pageSize=20`),
    placeholderData: (prev) => prev,
  });
}
export const useRestoreLead = () =>
  useLeadMutation((id: number) => proxyFetch<LeadDetail>(`/admin/leads/${id}/restore`, { method: "POST" }));
export const useLogLeadCall = (id: number) =>
  useLeadMutation((input: { outcome: LeadCallOutcome; notes?: string; nextCallDate?: string }) =>
    proxyFetch<LeadDetail>(`/admin/leads/${id}/calls`, { method: "POST", body: JSON.stringify(input) }),
  );
