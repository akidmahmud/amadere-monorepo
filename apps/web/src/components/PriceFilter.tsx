"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PriceRangeSlider } from "@amader/ui";
import { buildPlpHref, type PlpFilters } from "@/lib/plp";

// Same plain-data-props pattern as SortSelect/PlpPager — rendered from a
// Server Component (ProductListing), so it takes basePath + filters rather
// than a closure. `min`/`max` are the actual price bounds across this
// listing's full (unfiltered) product set, computed by the page itself.
export function PriceFilter({
  basePath,
  filters,
  min,
  max,
}: {
  basePath: string;
  filters: PlpFilters;
  min: number;
  max: number;
}) {
  const router = useRouter();
  const [live, setLive] = useState({
    min: filters.minPrice ?? min,
    max: filters.maxPrice ?? max,
  });

  // Debounced like OrderManagerPage's search-as-you-type — navigating on
  // every drag tick would fire a request per pixel; this waits for the
  // slider to sit still for a moment before updating the URL.
  useEffect(() => {
    const t = setTimeout(() => {
      router.push(
        buildPlpHref(basePath, {
          ...filters,
          minPrice: live.min === min ? undefined : live.min,
          maxPrice: live.max === max ? undefined : live.max,
          page: 1,
        }),
      );
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.min, live.max]);

  if (min >= max) return null;

  return (
    <div>
      <div className="mb-3.5 font-ui text-[15px] font-semibold text-ink">Price</div>
      <PriceRangeSlider
        min={min}
        max={max}
        valueMin={live.min}
        valueMax={live.max}
        onChange={(nextMin, nextMax) => setLive({ min: nextMin, max: nextMax })}
      />
    </div>
  );
}
