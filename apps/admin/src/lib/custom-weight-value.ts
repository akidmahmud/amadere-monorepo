import type { QueryClient } from "@tanstack/react-query";
import type { Attribute } from "@/hooks/useAttributes";
import { proxyFetch } from "@/lib/api/proxy-client";
import { findGramsValue, gramsLabel } from "@/lib/variant-weight";

/**
 * A custom weight typed in grams, as a real value of the attribute: an equal
 * existing one is reused ("1000" → "1KG"), otherwise "750 gram" is added.
 */
export async function ensureGramsValue(
  attr: Attribute,
  grams: number,
  qc: QueryClient,
): Promise<number> {
  const label = (v: Attribute["values"][number]) => v.translations[0]?.value ?? "";
  const existing = findGramsValue(
    attr.values.map((v) => ({ id: v.id, label: label(v) })),
    grams,
  );
  if (existing) return existing.id;
  const name = gramsLabel(grams);
  const saved = await proxyFetch<Attribute>(`/admin/attributes/${attr.id}/values`, {
    method: "POST",
    body: JSON.stringify({ translations: [{ locale: "EN", value: name }] }),
  });
  void qc.invalidateQueries({ queryKey: ["admin-attributes"] });
  const created = saved.values
    .filter((v) => label(v) === name)
    .sort((a, b) => b.id - a.id)[0];
  if (!created) throw new Error(`Could not add ${name}`);
  return created.id;
}
