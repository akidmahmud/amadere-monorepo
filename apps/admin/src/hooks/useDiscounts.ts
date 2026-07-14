import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";
import type { PublishStatus } from "@/hooks/useBrands";

export type DiscountType = "COUPON" | "PROMOTION";
export type DiscountValueType = "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";

export type AdminDiscount = Omit<components["schemas"]["DiscountDto"], "type" | "valueType" | "status"> & {
  type: DiscountType;
  valueType: DiscountValueType;
  status: PublishStatus;
};

export type DiscountInput = Omit<components["schemas"]["CreateDiscountDto"], "type" | "valueType" | "status"> & {
  type: DiscountType;
  valueType: DiscountValueType;
  status: PublishStatus;
};

type Paginated<T> = { items?: T[]; total?: number };
const KEY = ["admin-discounts"];

export function useDiscounts() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await proxyFetch<Paginated<AdminDiscount>>("/admin/discounts?pageSize=100");
      return res.items ?? [];
    },
  });
}

export function useDiscount(id: number) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => proxyFetch<AdminDiscount>(`/admin/discounts/${id}`),
    enabled: Number.isFinite(id),
  });
}

export function useCreateDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DiscountInput) =>
      proxyFetch<AdminDiscount>("/admin/discounts", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateDiscount(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<DiscountInput>) =>
      proxyFetch<AdminDiscount>(`/admin/discounts/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/discounts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
