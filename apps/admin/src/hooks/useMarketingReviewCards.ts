import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type MarketingReviewCard = components["schemas"]["AdminMarketingReviewCardDto"];
export type MarketingReviewCardInput = components["schemas"]["CreateMarketingReviewCardDto"];

const KEY = ["admin-marketing-review-cards"];

export function useMarketingReviewCards() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => proxyFetch<MarketingReviewCard[]>("/admin/marketing-review-cards"),
  });
}

export function useCreateMarketingReviewCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MarketingReviewCardInput) =>
      proxyFetch<MarketingReviewCard>("/admin/marketing-review-cards", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateMarketingReviewCard(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<MarketingReviewCardInput>) =>
      proxyFetch<MarketingReviewCard>(`/admin/marketing-review-cards/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteMarketingReviewCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/marketing-review-cards/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
