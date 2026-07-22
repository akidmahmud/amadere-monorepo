import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type DashboardOverview = components["schemas"]["DashboardOverviewDto"];

export function useDashboardOverview() {
  return useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: () => proxyFetch<DashboardOverview>("/admin/dashboard/overview"),
  });
}
