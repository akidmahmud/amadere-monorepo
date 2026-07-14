import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type MenuItem = components["schemas"]["AdminMenuItemDto"];
export type MenuItemInput = components["schemas"]["CreateMenuItemDto"];

const KEY = ["admin-menu-items"];

export function useMenuItems() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => proxyFetch<MenuItem[]>("/admin/menu-items"),
  });
}

export function useCreateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MenuItemInput) =>
      proxyFetch<MenuItem>("/admin/menu-items", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateMenuItem(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<MenuItemInput>) =>
      proxyFetch<MenuItem>(`/admin/menu-items/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/menu-items/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
