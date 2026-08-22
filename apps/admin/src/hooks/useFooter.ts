import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

// The admin GET and PUT carry the same shape, and UpdateFooterDto is the
// class the controller declares — so it is the name that exists in the
// generated schema. FooterConfig is a bare interface and never reaches it.
export type FooterConfig = components["schemas"]["UpdateFooterDto"];

const KEY = ["admin-footer"];

export function useFooter() {
  return useQuery({ queryKey: KEY, queryFn: () => proxyFetch<FooterConfig>("/admin/footer") });
}

type MediaDto = components["schemas"]["MediaDto"];

/** Resolves stored `mediaId`s to displayable URLs so a saved custom icon or
 * payment image shows its thumbnail on first load, not only in the session
 * where it was picked. The config stores ids, not URLs, and MediaPicker is
 * fully controlled on `value` — without this the admin reopens the page to
 * empty pickers and reasonably concludes nothing saved.
 *
 * One request per id rather than a batch endpoint: there are at most 15 of
 * them (10 social + 4 app buttons + payment), they are cached by id, and no
 * list endpoint takes an id filter. */
export function useMediaUrls(ids: number[]) {
  const key = [...new Set(ids)].sort((a, b) => a - b);
  return useQuery({
    queryKey: ["admin-media-urls", key],
    enabled: key.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        key.map(async (id) => {
          try {
            const media = await proxyFetch<MediaDto>(`/admin/media/${id}`);
            return [id, media.fullUrl ?? media.url] as const;
          } catch {
            // A deleted Media row leaves a dangling id in the config. Skip it
            // rather than failing the whole page — the footer still renders.
            return null;
          }
        }),
      );
      return Object.fromEntries(entries.filter((e): e is readonly [number, string] => e !== null));
    },
  });
}

export function useUpdateFooter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FooterConfig) =>
      proxyFetch<FooterConfig>("/admin/footer", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
