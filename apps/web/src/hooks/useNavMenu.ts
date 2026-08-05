import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

async function fetchNavMenu(locale: "EN" | "BN") {
  const { data, error } = await api.GET("/api/v1/menu", { params: { query: { locale } } });
  if (error) throw error;
  return data;
}

type NavMenu = Awaited<ReturnType<typeof fetchNavMenu>>;

// `initialData` is the server-fetched menu (see layout.tsx) — rendering the
// header/drawer's nav waits on nothing client-side; a background refetch
// (staleTime below) only updates it if it's actually gone stale.
export function useNavMenu(locale: "EN" | "BN", initialData?: NavMenu) {
  return useQuery({
    queryKey: ["nav-menu", locale],
    queryFn: () => fetchNavMenu(locale),
    initialData,
    staleTime: 5 * 60 * 1000,
  });
}
