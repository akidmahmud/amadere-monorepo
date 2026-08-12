import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type DashboardOverview = components["schemas"]["DashboardOverviewDto"];

// Every field below is genuinely present together once scope === "global" —
// the backend only omits them as a group for scope === "staff" — but the
// generated DTO type can't express that as a discriminated union (it's one
// flat class with optional fields), so this narrows it back for consumers
// instead of scattering `!`/`?? fallback` at every use site.
export type GlobalDashboardOverview = DashboardOverview &
  Required<
    Pick<
      DashboardOverview,
      | "totalRevenue"
      | "totalOrders"
      | "totalCustomers"
      | "totalProducts"
      | "completedOrderRate"
      | "avgOrderValue"
      | "today"
      | "completed"
      | "pending"
      | "statusBreakdown"
      | "ordersByChannel"
      | "topCustomers"
      | "monthlyRevenue"
      | "topProducts"
    >
  >;

export type StaffDashboardOverview = DashboardOverview &
  Required<
    Pick<DashboardOverview, "myAssignedOrdersTotal" | "myAssignedOrdersToday" | "myAssignedOrdersByStatus" | "myAssignedCustomersTotal">
  >;

export function useDashboardOverview() {
  return useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: () => proxyFetch<DashboardOverview>("/admin/dashboard/overview"),
  });
}
