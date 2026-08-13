import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export type UpsellTriggerType = "ITEM_COUNT" | "ORDER_AMOUNT";
export type UpsellCountMode = "TOTAL_UNITS" | "DISTINCT_PRODUCTS";

export interface UpsellBarSettings {
  enabled: boolean;
  countMode: UpsellCountMode;
  maxDiscountCap: number | null;
}

export interface UpsellStage {
  id: number;
  sortOrder: number;
  triggerType: UpsellTriggerType;
  triggerValue: string;
  discountPercent: string | null;
  discountFixedAmount: string | null;
  freeShipping: boolean;
  label: string;
  enabled: boolean;
}

export interface UpsellStageInput {
  sortOrder: number;
  triggerType: UpsellTriggerType;
  triggerValue: number;
  discountPercent?: number;
  discountFixedAmount?: number;
  freeShipping: boolean;
  label: string;
  enabled: boolean;
}

const SETTINGS_KEY = ["upsell-bar-settings"];
const STAGES_KEY = ["upsell-bar-stages"];

export function useUpsellBarSettings() {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: () => proxyFetch<UpsellBarSettings>("/admin/upsell-bar/settings") });
}

export function useUpdateUpsellBarSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<UpsellBarSettings>) =>
      proxyFetch<UpsellBarSettings>("/admin/upsell-bar/settings", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: (data) => qc.setQueryData(SETTINGS_KEY, data),
  });
}

export function useUpsellStages() {
  return useQuery({ queryKey: STAGES_KEY, queryFn: () => proxyFetch<UpsellStage[]>("/admin/upsell-bar/stages") });
}

export function useReplaceUpsellStages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stages: UpsellStageInput[]) =>
      proxyFetch<UpsellStage[]>("/admin/upsell-bar/stages", { method: "PUT", body: JSON.stringify({ stages }) }),
    onSuccess: (data) => qc.setQueryData(STAGES_KEY, data),
  });
}
