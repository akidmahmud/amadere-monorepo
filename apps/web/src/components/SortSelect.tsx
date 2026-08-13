"use client";

import { useRouter } from "next/navigation";
import { buildPlpHref, SORT_OPTIONS, type PlpFilters } from "@/lib/plp";

// Takes plain data (basePath + filters), not a `buildHref` closure — this is
// rendered from a Server Component (ProductListing), and functions can't be
// passed across the server/client boundary as props.
export function SortSelect({ basePath, filters }: { basePath: string; filters: PlpFilters }) {
  const router = useRouter();

  return (
    <select
      className="w-[104px] shrink-0 cursor-pointer truncate rounded border border-line bg-white px-2 py-1.5 font-ui text-[11px] text-ink outline-none sm:w-auto sm:text-xs"
      value={filters.sort}
      onChange={(e) =>
        router.push(buildPlpHref(basePath, { ...filters, sort: e.target.value as PlpFilters["sort"], page: 1 }), {
          scroll: false,
        })
      }
    >
      {SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
