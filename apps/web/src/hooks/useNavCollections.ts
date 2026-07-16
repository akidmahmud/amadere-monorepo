import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export function useNavCollections(locale: "EN" | "BN") {
  return useQuery({
    queryKey: ["nav-collections", locale],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/collections/nav", { params: { query: { locale } } });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
