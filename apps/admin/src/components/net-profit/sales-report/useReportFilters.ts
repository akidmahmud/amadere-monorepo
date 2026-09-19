"use client";
import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReportFilters } from "@/hooks/useSalesReportV2";

const todayDhaka = () =>
  new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function defaultFilters(): ReportFilters {
  const t = todayDhaka();
  return {
    basis: "order",
    from: addDays(t, -6),
    to: t,
    fromTime: "",
    toTime: "",
    channel: "all",
    agent: "all",
    courier: "all",
    district: "all",
    status: "all",
  };
}

export function quickRanges() {
  const t = todayDhaka();
  const monthStart = `${t.slice(0, 8)}01`;
  return [
    { key: "today", label: "Today", from: t, to: t },
    {
      key: "yday",
      label: "Yesterday",
      from: addDays(t, -1),
      to: addDays(t, -1),
    },
    { key: "7d", label: "Last 7 days", from: addDays(t, -6), to: t },
    { key: "30d", label: "Last 30 days", from: addDays(t, -29), to: t },
    { key: "month", label: "This month", from: monthStart, to: t },
  ];
}

/** Filters live in the URL so a view can be shared by link (spec §8). */
export function useReportFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const f = useMemo<ReportFilters>(() => {
    const d = defaultFilters();
    const g = (k: keyof ReportFilters) => params.get(k) ?? d[k];
    return {
      basis: g("basis") === "delivered" ? "delivered" : "order",
      from: g("from"),
      to: g("to"),
      fromTime: g("fromTime"),
      toTime: g("toTime"),
      channel: g("channel"),
      agent: g("agent"),
      courier: g("courier"),
      district: g("district"),
      status: g("status"),
    };
  }, [params]);

  const set = useCallback(
    (
      p: Partial<ReportFilters> & { tab?: string; q?: string; open?: string },
    ) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(p)) {
        if (v === undefined || v === "all" || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      if (
        next.get("from") &&
        next.get("to") &&
        next.get("from")! > next.get("to")!
      ) {
        if ("from" in p) next.set("to", next.get("from")!);
        else next.set("from", next.get("to")!);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, router, pathname],
  );

  const reset = useCallback(
    () =>
      set({
        channel: "all",
        agent: "all",
        courier: "all",
        district: "all",
        status: "all",
      }),
    [set],
  );
  return {
    f,
    set,
    reset,
    tab: params.get("tab") ?? "overview",
    q: params.get("q") ?? "",
    open: Number(params.get("open")) || null,
  };
}
