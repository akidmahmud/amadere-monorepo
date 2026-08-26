"use client";

/**
 * Helpers and the frequently-bought-together strip, lifted out of
 * CheckoutForm so the brain and the markup can both reach them without one
 * importing the other.
 *
 * Moved verbatim; only `export` was added.
 */
"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, FormProvider, useForm, type FieldErrors } from "react-hook-form";
import {
  Button,
  CartLineItem,
  Checkbox,
  Input,
  PaymentMethodSelector,
  SiteProductCard,
  UpsellProgressBar,
  formatMoney,
  useCartDrawerStore,
} from "@amader/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { AppLink } from "@/components/AppLink";
import { AddressFields } from "@/components/AddressFields";
import { OrderConfirmation } from "@/components/OrderConfirmation";
import { BlockPopup, type BlockPopupDetails } from "@/components/BlockPopup";
import { CodOtpPopup } from "@/components/CodOtpPopup";
import { toApiLocale } from "@/lib/api-locale";
import { toDisplayImageUrl, IMG } from "@/lib/media";
import { toProductCardData, type ProductCardData } from "@/lib/product-card-mapper";
import { pushEcommerceEvent, cartLineToGa4Item, addressToUserData } from "@/lib/analytics-events";
import { getDeviceId } from "@/lib/device-id";
import { getUtmParamsForCheckout } from "@/lib/utm";
import { ProxyApiError } from "@/lib/api/proxy-client";
import { makeCheckoutFormSchema, type CheckoutFormValues } from "@/lib/checkout-schema";
import { useAddToCart, useApplyCoupon, useCartQuery, useRemoveCartItem, useRemoveCoupon, useUpdateCartItem } from "@/hooks/useCart";
import { useGiftVoucherCheck, usePlaceOrder } from "@/hooks/useCheckout";
import type { CheckoutResult } from "@/hooks/useCheckout";
import { usePaymentMethodConfigs } from "@/hooks/useManualPayment";
import { useSiteInfo } from "@/hooks/useSiteInfo";
import { ShippingRatesNotice } from "@/components/ShippingRatesNotice";
import { useMe } from "@/hooks/useAuth";
import { SavedAddressPicker, type SavedAddress } from "@/components/SavedAddressPicker";
import { useAddresses } from "@/hooks/useAccount";
import { useCheckoutPrefill } from "@/hooks/useCheckoutPrefill";
import type { FraudPreflightResult } from "@/hooks/useCheckoutFraud";
import type { components } from "@/lib/api/schema";

export function isBlockDetails(details: unknown): details is BlockPopupDetails {
  return !!details && typeof details === "object" && (details as { blocked?: unknown }).blocked === true;
}

export const MANUAL_METHOD_LABELS: Record<string, string> = { BKASH: "bKash", NAGAD: "Nagad", ROCKET: "Rocket", UPAY: "Upay" };
export const STATIC_PAYMENT_OPTIONS = [
  { value: "COD", label: "Cash On Delivery" },
  { value: "SSLCOMMERZ", label: "Card / Online Payment", disabledLabel: "Coming soon" },
  { value: "BANK_TRANSFER", label: "Bank Transfer", disabledLabel: "Coming soon" },
];

export function cleanAddress(address: components["schemas"]["CheckoutAddressDto"]) {
  return {
    ...address,
    email: address.email?.trim() ? address.email : undefined,
    alternativePhone: address.alternativePhone?.trim() || undefined,
    area: address.area.trim(),
    landmark: address.landmark?.trim() || undefined,
    postCode: address.postCode?.trim() || undefined,
  };
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function toBnNum(num: number | string): string {
  const str = String(num);
  const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return str.replace(/\d/g, (d) => bnDigits[Number(d)]);
}

// Compact single-row bundle strip: [item] + [item] + [item] = [total + CTA].
// Replaces a much heavier block (large icon header, subtitle, savings badge,
// tall portrait cards, and a separate full-width summary bar underneath) that
// took roughly a screen and a half on a phone for what is an optional add-on.
// The arithmetic row reads as one sentence now, which is the point of the
// pattern — three things plus each other equal this price.
export function CheckoutFbtSection({
  cards,
  onAddItems,
  isPending,
  unchecked,
  onToggle,
}: {
  cards: ProductCardData[];
  onAddItems: (cardsToAdd: ProductCardData[]) => void;
  isPending?: boolean;
  /** Ids the customer has deselected. Owned by CheckoutForm, because this
   *  section renders twice — once for desktop above the form, once for
   *  mobile below it — and two copies with their own state would silently
   *  disagree about what is selected. Tracking the DEselected ids rather than
   *  the selected ones keeps "everything on by default" true without needing
   *  to re-seed state whenever the recommendation list changes. */
  unchecked: Set<number>;
  onToggle: (id: number) => void;
}) {
  if (cards.length === 0) return null;

  const checkedCards = cards.filter((c) => !unchecked.has(c.productId));
  const total = checkedCards.reduce((sum, c) => sum + Number(c.price), 0);
  const originalTotal = checkedCards.reduce(
    (sum, c) => sum + (c.originalPrice ? Number(c.originalPrice) : Number(c.price)),
    0,
  );
  const saved = Math.max(0, originalTotal - total);
  const savingsPercent =
    originalTotal > 0 && saved > 0 ? Math.round((saved / originalTotal) * 100) : 0;

  return (
    <section className="rounded-2xl border border-[#E5EFE7] bg-white p-4 sm:p-5">
      <h2 className="font-ui text-base font-bold text-[#1E293B] sm:text-lg">
        অন্যরাও সাথে নিয়েছেন
      </h2>
      <p className="mb-4 mt-0.5 font-body text-xs text-[#64748B]">
        একসাথে নিলে বেশি সাশ্রয়! নিচের আইটেমগুলো একসাথে নিন এবং বাঁচান।
      </p>

      {/* Wraps rather than scrolls: a stacked column on a phone keeps every
          item fully readable, where a horizontal scroller would hide the ones
          that matter most behind a swipe. */}
      <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:flex-wrap">
        {cards.map((card, index) => {
          const isChecked = !unchecked.has(card.productId);
          return (
            <Fragment key={card.productId}>
              {index > 0 && (
                <div className="flex shrink-0 items-center justify-center font-ui text-lg font-bold text-[#94A3B8] lg:px-0.5">
                  +
                </div>
              )}
              <button
                type="button"
                onClick={() => onToggle(card.productId)}
                aria-pressed={isChecked}
                aria-label={`${card.name} — ${isChecked ? "যোগ করা হয়েছে" : "যোগ করুন"}`}
                className={cn(
                  // The whole tile toggles, not just the box in the corner —
                  // a 16px checkbox is a poor tap target on a phone.
                  "relative flex flex-1 items-center gap-2.5 rounded-xl border-2 bg-white p-2 text-left transition-colors lg:min-w-[230px]",
                  isChecked ? "border-[#1B753C]" : "border-[#E5E5E5] hover:border-slate-300",
                )}
              >
                <span className="block h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#F8F9FA]">
                  {card.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.imageUrl} alt="" loading="lazy" className="h-full w-full object-contain" />
                  )}
                </span>

                <span className="min-w-0 flex-1 pr-5">
                  <span className="block truncate font-ui text-xs font-semibold text-[#1E293B]" title={card.name}>
                    {card.name}
                  </span>
                  <span className="mt-0.5 block font-ui text-sm font-bold text-[#1B753C]">
                    ৳{toBnNum(formatMoney(card.price).replace("৳", "").trim())}
                  </span>
                </span>

                <span
                  className={cn(
                    "absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded border-2 transition-colors",
                    isChecked
                      ? "border-[#1B753C] bg-[#1B753C] text-white"
                      : "border-slate-300 bg-white text-transparent",
                  )}
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              </button>
            </Fragment>
          );
        })}

        <div className="flex shrink-0 items-center justify-center font-ui text-lg font-bold text-[#94A3B8] lg:px-0.5">
          =
        </div>

        {/* Total and CTA as the last term of the equation, not a separate bar
            below it. */}
        <div className="flex shrink-0 flex-col items-center justify-center gap-1 rounded-xl bg-[#1B753C] px-4 py-3 text-white">
          <span className="flex items-baseline gap-1.5">
            <span className="font-ui text-lg font-extrabold leading-none">
              ৳{toBnNum(total.toFixed(0))}
            </span>
            {saved > 0 && (
              // What the same items cost bought separately — the number the
              // saving is measured against, so the claim below is checkable
              // rather than asserted.
              <span className="font-ui text-xs font-semibold leading-none text-white/60 line-through">
                ৳{toBnNum(originalTotal.toFixed(0))}
              </span>
            )}
          </span>
          {saved > 0 && (
            <span className="rounded-full bg-white/15 px-2 py-0.5 font-ui text-[0.7rem] font-bold leading-none text-white">
              সাশ্রয় ৳{toBnNum(saved.toFixed(0))} ({toBnNum(savingsPercent)}%)
            </span>
          )}
          <button
            type="button"
            disabled={isPending || checkedCards.length === 0}
            onClick={() => onAddItems(checkedCards)}
            className="mt-1 rounded-lg bg-white px-3 py-1.5 font-ui text-xs font-bold text-[#1B753C] transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "যোগ হচ্ছে…" : `কার্টে যোগ করুন (${toBnNum(checkedCards.length)})`}
          </button>
        </div>
      </div>
    </section>
  );
}

