import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  DailyReportDetail,
  DailyReportListItem,
  DailyReportSettings,
  DailyReportSettingsView,
} from "@amader/shared";
import { proxyFetch } from "@/lib/api/proxy-client";

const BASE = "/admin/net-profit/daily-reports";
const KEY = ["daily-reports"] as const;

export interface DailyReportPage {
  items: DailyReportListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export function useDailyReports(f: { date: string; q: string; page: number }) {
  const p = new URLSearchParams({ page: String(f.page) });
  if (f.date) p.set("date", f.date);
  if (f.q.trim()) p.set("q", f.q.trim());
  return useQuery({
    queryKey: [...KEY, "list", f],
    queryFn: () => proxyFetch<DailyReportPage>(`${BASE}?${p}`),
    placeholderData: keepPreviousData,
  });
}

export const useDailyReport = (id: number) =>
  useQuery({
    queryKey: [...KEY, "one", id],
    queryFn: () => proxyFetch<DailyReportDetail>(`${BASE}/${id}`),
    enabled: Number.isInteger(id) && id > 0,
  });

export function useGenerateDailyReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: {
      name: string;
      from: string;
      to: string;
      /** HH:MM (Dhaka); set both for exact times instead of 8 PM days. */
      fromTime?: string;
      toTime?: string;
    }) =>
      proxyFetch<DailyReportListItem>(BASE, {
        method: "POST",
        body: JSON.stringify(b),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteDailyReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      proxyFetch<{ id: number }>(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export const useDailyReportSettings = (enabled: boolean) =>
  useQuery({
    queryKey: [...KEY, "settings"],
    queryFn: () => proxyFetch<DailyReportSettingsView>(`${BASE}/settings`),
    enabled,
  });

export function useSaveDailyReportSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: DailyReportSettings) =>
      proxyFetch<DailyReportSettingsView>(`${BASE}/settings`, {
        method: "PUT",
        body: JSON.stringify(s),
      }),
    onSuccess: (data) => qc.setQueryData([...KEY, "settings"], data),
  });
}

export const dailyReportExportUrl = (id: number) =>
  `/api/backend${BASE}/${id}/export.xlsx`;
