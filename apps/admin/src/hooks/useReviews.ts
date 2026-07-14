import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
export const REVIEW_STATUSES: ReviewStatus[] = ["PENDING", "APPROVED", "REJECTED"];

export type AdminReview = Omit<components["schemas"]["ReviewDto"], "status"> & { status: ReviewStatus };

type Paginated<T> = { items?: T[]; total?: number };
const KEY = ["admin-reviews"];

export function useReviews(status?: ReviewStatus) {
  return useQuery({
    queryKey: [...KEY, status ?? "all"],
    queryFn: async () => {
      const qs = new URLSearchParams({ pageSize: "100" });
      if (status) qs.set("status", status);
      const res = await proxyFetch<Paginated<AdminReview>>(`/admin/reviews?${qs}`);
      return res.items ?? [];
    },
  });
}

export function useUpdateReviewStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: ReviewStatus }) =>
      proxyFetch<AdminReview>(`/admin/reviews/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useReplyToReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, message }: { id: number; message: string }) =>
      proxyFetch<AdminReview>(`/admin/reviews/${id}/reply`, { method: "POST", body: JSON.stringify({ message }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
