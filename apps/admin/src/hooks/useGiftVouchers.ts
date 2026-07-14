import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type GiftVoucher = components["schemas"]["GiftVoucherDto"];
export type GiftVoucherInput = components["schemas"]["CreateGiftVoucherDto"];

type Paginated<T> = { items?: T[]; total?: number };
const KEY = ["admin-gift-vouchers"];

// No update/delete endpoint — only create, list, and deactivate.
export function useGiftVouchers() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await proxyFetch<Paginated<GiftVoucher>>("/admin/gift-vouchers?pageSize=100");
      return res.items ?? [];
    },
  });
}

export function useCreateGiftVoucher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GiftVoucherInput) =>
      proxyFetch<GiftVoucher>("/admin/gift-vouchers", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeactivateGiftVoucher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<GiftVoucher>(`/admin/gift-vouchers/${id}/deactivate`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
