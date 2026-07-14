import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

export interface OrderStatusConfig {
  status: string;
  labelEn: string;
  labelBn: string;
  color: string;
  sortOrder: number;
}

const KEY = ["net-profit-order-statuses"];

export function useOrderStatusConfigs() {
  return useQuery({ queryKey: KEY, queryFn: () => proxyFetch<OrderStatusConfig[]>("/admin/net-profit/order-statuses") });
}

export function useUpdateOrderStatusConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ status, ...input }: { status: string; labelEn?: string; labelBn?: string; color?: string; sortOrder?: number }) =>
      proxyFetch<OrderStatusConfig>(`/admin/net-profit/order-statuses/${status}`, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
