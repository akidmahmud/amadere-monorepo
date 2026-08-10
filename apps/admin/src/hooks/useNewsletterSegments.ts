import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type SegmentType = "ALL" | "TAG" | "NEW_SUBSCRIBERS";

// Same swagger enum erasure as every other module — type comes out as Record<string, never>.
export type NewsletterSegment = Omit<components["schemas"]["AdminNewsletterSegmentDto"], "type"> & {
  type: SegmentType;
};

export interface SegmentInput {
  name: string;
  type: SegmentType;
  tagId?: number;
  days?: number;
}

const KEY = ["admin-newsletter-segments"];

export function useNewsletterSegments() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => proxyFetch<NewsletterSegment[]>("/admin/newsletter/segments"),
  });
}

export function useSegmentCount(id: number | null) {
  return useQuery({
    queryKey: [...KEY, id, "count"],
    queryFn: () => proxyFetch<{ count: number }>(`/admin/newsletter/segments/${id}/count`),
    enabled: id !== null,
  });
}

export function useCreateSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SegmentInput) => proxyFetch<NewsletterSegment>("/admin/newsletter/segments", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateSegment(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<SegmentInput>) => proxyFetch<NewsletterSegment>(`/admin/newsletter/segments/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/newsletter/segments/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
