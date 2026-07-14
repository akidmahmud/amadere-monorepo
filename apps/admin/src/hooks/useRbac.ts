import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type Permission = components["schemas"]["PermissionDto"];
export type Role = components["schemas"]["RoleDto"];
export type RoleInput = components["schemas"]["CreateRoleDto"];

const PERM_KEY = ["admin-permissions"];
const ROLE_KEY = ["admin-roles"];

export function usePermissions() {
  return useQuery({
    queryKey: PERM_KEY,
    queryFn: () => proxyFetch<Permission[]>("/admin/rbac/permissions"),
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ROLE_KEY,
    queryFn: () => proxyFetch<Role[]>("/admin/rbac/roles"),
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RoleInput) => proxyFetch<Role>("/admin/rbac/roles", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROLE_KEY }),
  });
}

export function useUpdateRole(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<RoleInput>) =>
      proxyFetch<Role>(`/admin/rbac/roles/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROLE_KEY }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/rbac/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROLE_KEY }),
  });
}
