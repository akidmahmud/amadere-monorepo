import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type MenuItem = components["schemas"]["AdminMenuItemDto"];
export type MenuItemInput = components["schemas"]["CreateMenuItemDto"];

const KEY = ["admin-menu-items"];

export function useMenuItems(q?: string) {
  return useQuery({
    queryKey: [...KEY, q],
    queryFn: () => {
      const url = `/admin/menu-items${q ? `?q=${encodeURIComponent(q)}` : ""}`;
      return proxyFetch<MenuItem[]>(url);
    },
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

// parentId is widened to allow `null` (un-nesting to root) — the generated
// CreateMenuItemDto only types it as `number | undefined` since create has no
// concept of clearing a parent, but PATCH needs to send `null` explicitly and
// the backend's class-validator `@IsOptional()` already treats null as valid.
export function useUpdateMenuItem(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Omit<MenuItemInput, "parentId">> & { parentId?: number | null }) =>
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

// Drag-and-drop reorder/re-nest sends one PATCH per item that actually moved
// (usually 1, occasionally a handful) rather than a bulk endpoint — the
// existing single-item PATCH already accepts parentId+sortOrder, so this
// reuses it instead of adding new backend surface for what's a rare, small
// batch of updates.
export function useMoveMenuItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (moves: { id: number; parentId: number | null; sortOrder: number }[]) => {
      await Promise.all(
        moves.map(({ id, parentId, sortOrder }) =>
          proxyFetch<MenuItem>(`/admin/menu-items/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ parentId, sortOrder }),
          }),
        ),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useImportMenuItemsFromCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => proxyFetch<MenuItem[]>("/admin/menu-items/import-from-categories", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
