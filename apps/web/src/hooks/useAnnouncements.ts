import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

async function fetchAnnouncements(locale: "EN" | "BN") {
  const { data, error } = await api.GET("/api/v1/announcements", { params: { query: { locale } } });
  if (error) throw error;
  return data;
}

type Announcements = Awaited<ReturnType<typeof fetchAnnouncements>>;

// `initialData` is the server-fetched list (see layout.tsx) — the bar
// renders in the first paint instead of appearing after a client fetch.
export function useAnnouncements(locale: "EN" | "BN", initialData?: Announcements) {
  return useQuery({
    queryKey: ["announcements", locale],
    queryFn: () => fetchAnnouncements(locale),
    initialData,
    staleTime: 5 * 60 * 1000,
  });
}
