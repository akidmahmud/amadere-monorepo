import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch, ProxyApiError } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";
import type { ApiErrorResponse } from "@amader/shared";

type MediaDto = components["schemas"]["MediaDto"];
type Paginated<T> = { items?: T[]; total?: number };

export function useMediaLibrary() {
  return useQuery({
    queryKey: ["admin-media"],
    queryFn: async () => {
      const res = await fetch("/api/backend/admin/media?pageSize=60");
      const body = (await res.json()) as { success: true; data: Paginated<MediaDto> } | ApiErrorResponse;
      if (!body.success) throw new ProxyApiError(res.status, body.error.code, body.error.message);
      return body.data.items ?? [];
    },
  });
}

// Fails with a 409 if the media is still attached to a product (backend
// enforces this — see media.service.ts's delete()) — surfaced as a normal
// mutation error, not swallowed.
export function useDeleteMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/media/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-media"] }),
  });
}

// Goes to the dedicated /api/backend/admin/media route (not proxyFetch —
// this is a multipart upload, not JSON; see that route's own comment for why
// it can't share the generic [...path] proxy).
export function useUploadMedia() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/backend/admin/media", { method: "POST", body: form });
      const body = (await res.json()) as { success: true; data: MediaDto } | ApiErrorResponse;
      if (!body.success) throw new ProxyApiError(res.status, body.error.code, body.error.message);
      return body.data;
    },
  });
}
