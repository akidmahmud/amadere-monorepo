import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export type BlockType = "PHONE" | "EMAIL" | "IP" | "DEVICE";
export type BlockSource = "MANUAL" | "AUTO";

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
  expiresAt: string | null;
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

const KEY = ["net-profit-blocker"];

export function useBlockRules() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => proxyFetch<BlockRule[]>("/admin/net-profit/blocker"),
  });
}

export function useCreateBlockRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBlockRuleInput) =>
      proxyFetch<BlockRule>("/admin/net-profit/blocker", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
