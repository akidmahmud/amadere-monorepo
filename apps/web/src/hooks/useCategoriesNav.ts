import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

async function fetchCategoriesNav(locale: "EN" | "BN") {
  const { data, error } = await api.GET("/api/v1/categories/nav", { params: { query: { locale } } });
  if (error) throw error;
  return data;
}

type CategoriesNav = Awaited<ReturnType<typeof fetchCategoriesNav>>;

// `initialData` is the server-fetched nav (see layout.tsx) — rendering the
// header/drawer's category list waits on nothing client-side; a background
// refetch (staleTime below) only updates it if it's actually gone stale.
export function useCategoriesNav(locale: "EN" | "BN", initialData?: CategoriesNav) {
  return useQuery({
    queryKey: ["categories-nav", locale],
    queryFn: () => fetchCategoriesNav(locale),
    initialData,
    staleTime: 5 * 60 * 1000,
  });
}
