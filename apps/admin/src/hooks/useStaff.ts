import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type StaffStatus = "ACTIVE" | "DISABLED";
export type AdminStaff = Omit<components["schemas"]["AdminUserDto"], "status"> & { status: StaffStatus };
export type CreateStaffInput = components["schemas"]["CreateAdminUserDto"];
export type UpdateStaffInput = components["schemas"]["UpdateAdminUserDto"];
export type LoginHistoryEntry = components["schemas"]["AdminLoginHistoryEntryDto"];

type Paginated<T> = { items?: T[]; total?: number };
const KEY = ["admin-staff"];

export function useStaffList() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => proxyFetch<AdminStaff[]>("/admin/staff"),
  });
}

export function useStaffLoginHistory(id: number) {
  return useQuery({
    queryKey: [...KEY, id, "login-history"],
    queryFn: async () => {
      const res = await proxyFetch<Paginated<LoginHistoryEntry>>(`/admin/staff/${id}/login-history`);
      return res.items ?? [];
    },
    enabled: Number.isFinite(id),
  });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStaffInput) =>
      proxyFetch<AdminStaff>("/admin/staff", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateStaff(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateStaffInput) =>
      proxyFetch<AdminStaff>(`/admin/staff/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/staff/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
