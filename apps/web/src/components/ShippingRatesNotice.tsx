"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@amader/ui";
import { useShippingZones } from "@/hooks/useShippingZones";
import { useShippingRules } from "@/hooks/useShippingRules";
import { useCheckoutContext } from "./checkout/CheckoutContext";

/** Show the server-calculated fee for this order, including shipping discounts. */
export function ShippingRatesNotice({ district }: { district?: string }) {
  const locale = useLocale();
  const t = useTranslations("shipping");
  const { cart, shippingQuotePending, shippingQuoteError } = useCheckoutContext();
  const { data: zones } = useShippingZones(locale.toUpperCase());
  const { data: rules, isPending, isError } = useShippingRules();

  if (!district?.trim() || !cart?.items.length || isPending || isError || shippingQuoteError) return null;
  if (!rules?.applyOnCheckout && !zones?.length) return null;

  return (
    <div
      className="mt-4 flex items-center justify-between gap-3 rounded-brand border border-line bg-cream/40 p-4 font-ui text-[13px] font-semibold text-green"
      aria-live="polite"
      aria-busy={shippingQuotePending}
    >
      <span>{t("ratesHeading")}</span>
      <span className="shrink-0 tabular-nums">
        {shippingQuotePending ? "..." : formatMoney(cart.shippingFee)}
      </span>
    </div>
  );
}
