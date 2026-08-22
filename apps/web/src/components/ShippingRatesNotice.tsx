"use client";

import { useLocale, useTranslations } from "next-intl";
import { useShippingZones } from "@/hooks/useShippingZones";
import { formatMoney } from "@amader/ui";

/**
 * The shipping rate table, shown under Shipping Address so the customer can
 * see what applies before committing to a district — rather than picking one
 * and watching the total move.
 *
 * Reads the same config the backend charges from, so the highlighted row can
 * never disagree with the "Shipping fee" line in the order summary.
 */
export function ShippingRatesNotice({ district }: { district?: string }) {
  const locale = useLocale();
  const t = useTranslations("shipping");
  const { data: zones } = useShippingZones(locale.toUpperCase());

  if (!zones || zones.length === 0) return null;

  const needle = district?.trim().toLowerCase();
  const matchedIndex = needle
    ? zones.findIndex((z) => z.districts.some((d) => d.toLowerCase() === needle))
    : -1;
  // A district that matches no zone falls to the fallback row, which is
  // always last. Only highlight it once the customer has actually chosen a
  // district — before that, nothing is "their" rate yet.
  const activeIndex =
    matchedIndex >= 0 ? matchedIndex : needle ? zones.findIndex((z) => z.isFallback) : -1;

  return (
    <div className="mt-4 rounded-brand border border-line bg-cream/40 p-4">
      <h3 className="font-ui text-[13px] font-semibold text-green">{t("ratesHeading")}</h3>
      <ul className="mt-2.5 flex flex-col gap-1.5">
        {zones.map((zone, i) => {
          const active = i === activeIndex;
          return (
            <li
              key={i}
              className={`flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 font-body text-xs transition-colors ${
                active ? "bg-green/10 font-semibold text-green" : "text-muted"
              }`}
            >
              <span>
                {zone.name}
                {zone.isFallback && (
                  <span className="ml-1.5 font-normal opacity-70">({t("allOtherDistricts")})</span>
                )}
              </span>
              <span className="shrink-0 tabular-nums">{formatMoney(String(zone.fee))}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2.5 font-body text-[11px] text-muted">
        {activeIndex >= 0 ? t("appliedToYourDistrict") : t("pickDistrictHint")}
      </p>
    </div>
  );
}
