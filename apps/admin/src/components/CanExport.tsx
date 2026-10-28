"use client";

import { useCan } from "@/hooks/useAdminAuth";

/** Shows an Export / download button only to roles with data.export. */
export function CanExport({ children }: { children: React.ReactNode }) {
  return useCan("data.export") ? <>{children}</> : null;
}
