import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

// Same swagger enum-erasure fix as every other module (source on the
// response DTO comes out as Record<string, never>).
export const PROMO_VIDEO_SOURCES = ["YOUTUBE", "TIKTOK", "INSTAGRAM", "FACEBOOK", "CUSTOM_URL", "R2", "GIF"] as const;
export type PromoVideoSource = (typeof PROMO_VIDEO_SOURCES)[number];

export type AdminPromoVideo = Omit<components["schemas"]["AdminPromoVideoDto"], "source"> & {
  source: PromoVideoSource;
};

export type PromoVideoInput = Omit<components["schemas"]["CreatePromoVideoDto"], "source"> & {
  source: PromoVideoSource;
};

const KEY = ["admin-promo-videos"];

export function usePromoVideos(q?: string) {
  return useQuery({
    queryKey: [...KEY, q],
    queryFn: () => {
      const url = `/admin/promo-videos${q ? `?q=${encodeURIComponent(q)}` : ""}`;
      return proxyFetch<AdminPromoVideo[]>(url);
    },
  });
}

export function useCreatePromoVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PromoVideoInput) =>
      proxyFetch<AdminPromoVideo>("/admin/promo-videos", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdatePromoVideo(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<PromoVideoInput>) =>
      proxyFetch<AdminPromoVideo>(`/admin/promo-videos/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeletePromoVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/promo-videos/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useReorderPromoVideos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) =>
      proxyFetch<void>("/admin/promo-videos/reorder", { method: "PATCH", body: JSON.stringify({ ids }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
