import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

// The backend never annotated this endpoint's response DTO at all (schema.d.ts
// shows `content?: never` for it — not even the usual Record<string,never>
// erasure, just nothing) — hand-typed from the real response observed live
// against this exact endpoint earlier in this build (Phase 1 verification).
export interface AuditLogEntry {
  id: number;
  adminUserId: number;
  action: string;
  entityType: string;
  entityId: number | null;
  entityLabel: string | null;
  changes: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function useAuditLog(filters: { entityType?: string; adminUserId?: number }) {
  return useQuery({
    queryKey: ["admin-audit-log", filters],
    queryFn: () => {
      const qs = new URLSearchParams({ pageSize: "50" });
      if (filters.entityType) qs.set("entityType", filters.entityType);
      if (filters.adminUserId) qs.set("adminUserId", String(filters.adminUserId));
      return proxyFetch<Paginated<AuditLogEntry>>(`/admin/audit-log?${qs}`);
    },
  });
}
