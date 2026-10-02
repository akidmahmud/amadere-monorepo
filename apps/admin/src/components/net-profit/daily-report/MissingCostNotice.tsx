import Link from "next/link";
import type { DailyReportSnapshot } from "@amader/shared";

/**
 * Products that sold with no cost price on record. Their cost counted as ৳0,
 * so profit is overstated until a cost is set. A product's FIRST cost also
 * covers its past sales, so setting it and generating again fixes this report.
 */
export function MissingCostNotice({ s }: { s: DailyReportSnapshot }) {
  const missing = new Map<string, string>();
  for (const b of s.sources)
    for (const p of b.products) if (p.estimated > 0) missing.set(p.key, p.name);
  if (missing.size === 0) return null;

  return (
    <div className="rounded-sm border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-semibold">
        {missing.size} product{missing.size > 1 ? "s have" : " has"} no cost
        price, so {missing.size > 1 ? "their" : "its"} cost is counted as ৳0 and
        profit is shown too high (marked “est.” below).
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {[...missing].map(([key, name]) => {
          const id = /^p(\d+)$/.exec(key)?.[1];
          return (
            <li key={key}>
              {id ? (
                <Link
                  href={`/products/${id}`}
                  className="font-medium underline hover:text-amber-950"
                >
                  {name}
                </Link>
              ) : (
                <span>{name} (product deleted)</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2">
        <strong>Where to fix:</strong> open the product (links above) and fill
        in <strong>Cost Price</strong> in its Pricing section, or set it in{" "}
        <Link
          href="/net-profit/reports?tab=settings"
          className="font-medium underline"
        >
          Net Profit → Sales Report → Rates and costs
        </Link>
        . Then generate this report again; a saved report does not change by
        itself.
      </p>
    </div>
  );
}
