import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

// SynonymTermDto.locale is erased to Record<string, never> by the same
// swagger gap as everywhere else — re-typed locally, same fix as usual.
export interface SynonymTerm {
  locale: "EN" | "BN";
  term: string;
}
export interface SynonymGroup {
  id: number;
  terms: SynonymTerm[];
}

const KEY = ["admin-synonyms"];

export function useSynonymGroups() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => proxyFetch<SynonymGroup[]>("/admin/search-synonyms"),
  });
}

export function useCreateSynonymGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (terms: SynonymTerm[]) =>
      proxyFetch<SynonymGroup>("/admin/search-synonyms", { method: "POST", body: JSON.stringify({ terms }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateSynonymGroup(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (terms: SynonymTerm[]) =>
      proxyFetch<SynonymGroup>(`/admin/search-synonyms/${id}`, { method: "PATCH", body: JSON.stringify({ terms }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteSynonymGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/search-synonyms/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
