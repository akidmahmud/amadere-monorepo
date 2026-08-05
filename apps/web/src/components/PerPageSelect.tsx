"use client";

import { useRouter } from "next/navigation";
import { buildPlpHref, PAGE_SIZE_OPTIONS, type PlpFilters } from "@/lib/plp";

// Pixel-matched to ghorerbazar.com's "Show" per-page select on the offer-zone
// collection page — same plain-data-in, router.push-on-change pattern as
// SortSelect (this is rendered from a Server Component, so a buildHref
// closure can't be passed as a prop, only plain basePath + filters).
export function PerPageSelect({ basePath, filters }: { basePath: string; filters: PlpFilters }) {
  const router = useRouter();

  return (
    <select
      className="w-[84px] shrink-0 cursor-pointer truncate rounded border border-line bg-white px-2 py-1.5 font-ui text-[11px] text-header-green outline-none sm:w-auto sm:text-xs"
      value={filters.pageSize ?? ""}
      onChange={(e) =>
        router.push(
          buildPlpHref(basePath, {
            ...filters,
            pageSize: e.target.value ? Number(e.target.value) : undefined,
            page: 1,
          }),
        )
      }
    >
      <option value="">Default</option>
      {PAGE_SIZE_OPTIONS.map((size) => (
        <option key={size} value={size}>
          Show {size}
        </option>
      ))}
    </select>
  );
}
