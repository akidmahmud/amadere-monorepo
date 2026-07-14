import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export function useSiteInfo() {
  return useQuery({
    queryKey: ["site-info"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/settings/site");
      if (error) throw error;
      return data;
    },
    staleTime: Infinity,
  });
}
