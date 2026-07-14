import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

export type Attribute = components["schemas"]["AttributeDto"];

// Same swagger enum-erasure fix as PublishStatus/HomepageSectionType — the
// `locale` field on these translation DTOs also comes out as
// `Record<string, never>` from codegen.
type Locale = "EN" | "BN";
export type AttributeInput = Omit<components["schemas"]["CreateAttributeDto"], "translations"> & {
  translations: { locale: Locale; name: string }[];
};
export type AttributeValueInput = Omit<components["schemas"]["CreateAttributeValueDto"], "translations"> & {
  translations: { locale: Locale; value: string }[];
};

const KEY = ["admin-attributes"];

// No pagination on this one — the backend returns a plain array (confirmed
// in schema.d.ts), unlike every other admin list endpoint.
export function useAttributes() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => proxyFetch<Attribute[]>("/admin/attributes"),
  });
}

export function useAttribute(id: number) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => proxyFetch<Attribute>(`/admin/attributes/${id}`),
    enabled: Number.isFinite(id),
  });
}

export function useCreateAttribute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AttributeInput) =>
      proxyFetch<Attribute>("/admin/attributes", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateAttribute(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AttributeInput>) =>
      proxyFetch<Attribute>(`/admin/attributes/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteAttribute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch<void>(`/admin/attributes/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useAddAttributeValue(attributeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AttributeValueInput) =>
      proxyFetch<Attribute>(`/admin/attributes/${attributeId}/values`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateAttributeValue(attributeId: number, valueId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AttributeValueInput>) =>
      proxyFetch<Attribute>(`/admin/attributes/${attributeId}/values/${valueId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteAttributeValue(attributeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (valueId: number) =>
      proxyFetch<void>(`/admin/attributes/${attributeId}/values/${valueId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
