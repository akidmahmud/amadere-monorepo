import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export type BlockType = "PHONE" | "EMAIL" | "IP" | "DEVICE" | "NAME" | "ADDRESS";
export type BlockSource = "MANUAL" | "AUTO";
export type BlockRuleStatus = "active" | "unblocked" | "expired";

export interface BlockRule {
  id: number;
  type: BlockType;
  value: string;
  source: BlockSource;
  category: string | null;
  customerName: string | null;
  addressText: string | null;
  reason: string | null;
  note: string | null;
  isActive: boolean;
  status: BlockRuleStatus;
  expiresAt: string | null;
  metadata: Record<string, unknown> | null;
  createdBy: number | null;
  createdAt: string;
}

export interface CreateBlockRuleInput {
  type: BlockType;
  value: string;
  category?: string;
  customerName?: string;
  addressText?: string;
  reason?: string;
  note?: string;
  expiresAt?: string;
}

export const RULE_KEYS = [
  "ipTracker",
  "processingCooldown",
  "bulkOrderBlocker",
  "courierSuccessRate",
  "phoneValidation",
  "duplicateOrder",
  "blacklistedEmailDomain",
  "minimumOrderAmount",
  "dailyOrderLimit",
  "newCustomerHighValue",
  "speedBotDetection",
  "proxyTorDetection",
] as const;
export type RuleKey = (typeof RULE_KEYS)[number];

export const RULE_LABELS: Record<RuleKey, string> = {
  ipTracker: "IP Tracker",
  processingCooldown: "Processing Order Cooldown",
  bulkOrderBlocker: "Bulk Order Blocker",
  courierSuccessRate: "Courier Success Rate Block",
  phoneValidation: "Phone Number Validation",
  duplicateOrder: "Duplicate Order Detection",
  blacklistedEmailDomain: "Blacklisted Email Domain Block",
  minimumOrderAmount: "Minimum Order Amount Block",
  dailyOrderLimit: "Maximum Order Limit Per Day",
  newCustomerHighValue: "New Customer High Value Block",
  speedBotDetection: "Speed/Bot Detection",
  proxyTorDetection: "Proxy/Tor Detection Block",
};

export const RULE_HINTS: Record<RuleKey, string> = {
  ipTracker: "Blocks when the same IP places too many orders in a time window.",
  processingCooldown: "Blocks a new order while a prior order from the same phone is still in flight.",
  bulkOrderBlocker: "Blocks when Pending/On-Hold/Failed orders from the same phone pass a limit.",
  courierSuccessRate: "Blocks phones whose courier delivery success rate is below the threshold.",
  phoneValidation: "Requires a valid 11-digit Bangladeshi mobile number.",
  duplicateOrder: "Blocks re-submitting the same cart from the same phone/email shortly after.",
  blacklistedEmailDomain: "Blocks checkout from disposable/temporary email domains.",
  minimumOrderAmount: "Blocks orders below a minimum cart value.",
  dailyOrderLimit: "Limits how many orders one phone can place per day.",
  newCustomerHighValue: "Blocks a first-time customer's high-value order for manual review.",
  speedBotDetection: "Blocks checkout submitted implausibly fast (bot/auto-submit).",
  proxyTorDetection: "Blocks checkout from a detected VPN/proxy connection.",
};

export interface RuleConfig {
  enabled: boolean;
  durationMinutes: number;
  heading: string;
  sub: string;
  message: string;
}

export interface BlockerSettings {
  enabled: boolean;
  showReasonInPopup: boolean;
  defaultDurationMinutes: number;
  manual: { heading: string; sub: string; message: string };
  rules: Record<RuleKey, RuleConfig>;
  thresholds: {
    ipTrackerMaxOrders: number;
    ipTrackerWindowMinutes: number;
    processingCooldownMinutes: number;
    bulkPendingLimit: number;
    bulkHoldLimit: number;
    bulkFailedLimit: number;
    bulkWindowMinutes: number;
    courierThresholdPercent: number;
    duplicateWindowMinutes: number;
    minOrderAmount: number;
    dailyOrderLimit: number;
    highValueAmount: number;
    speedSeconds: number;
    blacklistedDomains: string[];
  };
  popup: {
    defaultHeading: string;
    defaultSub: string;
    callEnabled: boolean;
    callNumber: string;
    whatsappEnabled: boolean;
    whatsappNumber: string;
    emailEnabled: boolean;
    emailAddress: string;
  };
}

export interface BlockerStats {
  todayAuto: number;
  yesterdayAuto: number;
  monthTotal: number;
  allTime: number;
  active: number;
}

export interface ListFilters {
  source?: BlockSource;
  status?: BlockRuleStatus;
  q?: string;
  page?: number;
  pageSize?: number;
}

const KEY = ["net-profit-blocker"];
const SETTINGS_KEY = ["net-profit-blocker-settings"];
const STATS_KEY = ["net-profit-blocker-stats"];

function toQueryString(filters: ListFilters): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function useBlockRules(filters: ListFilters = {}) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: () => proxyFetch<{ items: BlockRule[]; total: number }>(`/admin/net-profit/blocker${toQueryString(filters)}`),
  });
}

export function useBlockerStats() {
  return useQuery({
    queryKey: STATS_KEY,
    queryFn: () => proxyFetch<BlockerStats>("/admin/net-profit/blocker/stats"),
  });
}

export function useCreateBlockRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBlockRuleInput) =>
      proxyFetch<BlockRule>("/admin/net-profit/blocker", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: STATS_KEY });
    },
  });
}

export function useSetBlockRuleActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      proxyFetch<BlockRule>(`/admin/net-profit/blocker/${id}/active`, { method: "PUT", body: JSON.stringify({ isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteBlockRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/net-profit/blocker/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: STATS_KEY });
    },
  });
}

export function useBulkUnblock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (source: BlockSource) =>
      proxyFetch<{ count: number }>("/admin/net-profit/blocker/bulk-unblock", { method: "POST", body: JSON.stringify({ source }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useBlockerSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => proxyFetch<BlockerSettings>("/admin/net-profit/blocker/settings"),
  });
}

export function useUpdateBlockerSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: Partial<BlockerSettings>) =>
      proxyFetch<BlockerSettings>("/admin/net-profit/blocker/settings", { method: "PUT", body: JSON.stringify(dto) }),
    onSuccess: (data) => qc.setQueryData(SETTINGS_KEY, data),
  });
}

export function useImportBlockerCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      // Dedicated route (not proxyFetch) — a multipart body must stay
      // FormData all the way through, see api/backend/.../blocker/import/route.ts.
      const res = await fetch("/api/backend/admin/net-profit/blocker/import", { method: "POST", body: form });
      const body = await res.json();
      if (!body.success) throw new Error(body.error?.message ?? "Import failed");
      return body.data as { imported: number; skipped: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: STATS_KEY });
    },
  });
}

export function blockerExportUrl(source?: BlockSource): string {
  const qs = source ? `?source=${source}` : "";
  return `/api/backend/admin/net-profit/blocker/export${qs}`;
}
