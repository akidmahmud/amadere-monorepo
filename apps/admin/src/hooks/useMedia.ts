import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch, ProxyApiError } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";
import type { ApiErrorResponse } from "@amader/shared";

type MediaDto = components["schemas"]["MediaDto"];
type MediaFolderDto = components["schemas"]["MediaFolderDto"];
type Paginated<T> = { items?: T[]; total?: number };

export interface MediaLibraryFilters {
  /** Only media inside this folder. */
  folderId?: number;
  /** Only media not assigned to any folder — ignored if folderId is set. */
  unfiled?: boolean;
}

function toQueryString(filters: MediaLibraryFilters): string {
  const params = new URLSearchParams();
  params.set("pageSize", "100");
  if (filters.folderId !== undefined) params.set("folderId", String(filters.folderId));
  else if (filters.unfiled) params.set("unfiled", "true");
  return `?${params.toString()}`;
}

export function useMediaLibrary(filters: MediaLibraryFilters = {}) {
  return useQuery({
    queryKey: ["admin-media", filters],
    queryFn: async () => {
      const res = await fetch(`/api/backend/admin/media${toQueryString(filters)}`);
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

export function useUpdateMediaAltText() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, altText }: { id: number; altText: string }) =>
      proxyFetch<MediaDto>(`/admin/media/${id}`, { method: "PATCH", body: JSON.stringify({ altText }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-media"] }),
  });
}

// Drag-a-thumbnail-onto-a-folder — same PATCH endpoint as alt text, just a
// distinct hook so call sites read clearly. `folderId: null` un-files it.
export function useMoveMediaToFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, folderId }: { id: number; folderId: number | null }) =>
      proxyFetch<MediaDto>(`/admin/media/${id}`, { method: "PATCH", body: JSON.stringify({ folderId }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-media"] }),
  });
}

// Goes to the dedicated /api/backend/admin/media route (not proxyFetch —
// this is a multipart upload, not JSON; see that route's own comment for why
// it can't share the generic [...path] proxy).
export function useUploadMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/backend/admin/media", { method: "POST", body: form });
      const body = (await res.json()) as { success: true; data: MediaDto } | ApiErrorResponse;
      if (!body.success) throw new ProxyApiError(res.status, body.error.code, body.error.message);
      return body.data;
    },
    // MediaPicker's "Browse library" grid (a plain useQuery read, not
    // invalidated automatically by TanStack) needs to see freshly uploaded
    // files immediately when uploading from inside the folder browser.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-media"] }),
  });
}

const FOLDERS_KEY = ["admin-media-folders"];

export function useMediaFolders() {
  return useQuery({
    queryKey: FOLDERS_KEY,
    queryFn: () => proxyFetch<MediaFolderDto[]>("/admin/media-folders"),
  });
}

export function useCreateMediaFolder() {
  const qc = useQueryClient();
  return useMutation({
    // `parentId` omitted (or null) creates a top-level folder; pass the
    // folder currently being viewed to nest inside it.
    mutationFn: ({ name, parentId }: { name: string; parentId?: number | null }) =>
      proxyFetch<MediaFolderDto>("/admin/media-folders", {
        method: "POST",
        body: JSON.stringify({ name, parentId: parentId ?? undefined }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: FOLDERS_KEY }),
  });
}

export function useDeleteMediaFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/media-folders/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FOLDERS_KEY });
      // Media that was inside the deleted folder is now unfiled — any open
      // library view needs to reflect that.
      qc.invalidateQueries({ queryKey: ["admin-media"] });
    },
  });
}
