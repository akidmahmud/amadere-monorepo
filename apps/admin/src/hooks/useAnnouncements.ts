import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type Announcement = components["schemas"]["AdminAnnouncementDto"];
export type AnnouncementInput = components["schemas"]["CreateAnnouncementDto"];

const KEY = ["admin-announcements"];

export function useAnnouncements() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => proxyFetch<Announcement[]>("/admin/announcements"),
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AnnouncementInput) =>
      proxyFetch<Announcement>("/admin/announcements", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateAnnouncement(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AnnouncementInput>) =>
      proxyFetch<Announcement>(`/admin/announcements/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/announcements/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
