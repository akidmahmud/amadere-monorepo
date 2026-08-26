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

function isBlockDetails(details: unknown): details is BlockPopupDetails {
  return !!details && typeof details === "object" && (details as { blocked?: unknown }).blocked === true;
}

const MANUAL_METHOD_LABELS: Record<string, string> = { BKASH: "bKash", NAGAD: "Nagad", ROCKET: "Rocket", UPAY: "Upay" };
const STATIC_PAYMENT_OPTIONS = [
  { value: "COD", label: "Cash On Delivery" },
  { value: "SSLCOMMERZ", label: "Card / Online Payment", disabledLabel: "Coming soon" },
  { value: "BANK_TRANSFER", label: "Bank Transfer", disabledLabel: "Coming soon" },
];

function cleanAddress(address: components["schemas"]["CheckoutAddressDto"]) {
  return {
    ...address,
    email: address.email?.trim() ? address.email : undefined,
    alternativePhone: address.alternativePhone?.trim() || undefined,
    area: address.area.trim(),
    landmark: address.landmark?.trim() || undefined,
    postCode: address.postCode?.trim() || undefined,
  };
}

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

function toBnNum(num: number | string): string {
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
function CheckoutFbtSection({
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

export function CheckoutForm() {
  const locale = toApiLocale(useLocale());
  const router = useRouter();
  const [placedOrder, setPlacedOrder] = useState<CheckoutResult | null>(null);
  const [voucherInput, setVoucherInput] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [blockPopupDismissed, setBlockPopupDismissed] = useState(false);
  const [fraudResult, setFraudResult] = useState<FraudPreflightResult | null>(null);
  const [preflightBlock, setPreflightBlock] = useState<BlockPopupDetails | null>(null);
  const [showOtpPopup, setShowOtpPopup] = useState(false);
  const checkoutStartedAtRef = useRef(Math.floor(Date.now() / 1000));
  const shippingAddressRef = useRef<HTMLDivElement>(null);
  const closeCartDrawer = useCartDrawerStore((s) => s.close);
  const queryClient = useQueryClient();

  // The cart drawer can be left open from wherever the customer clicked
  // through to checkout from (e.g. "View Cart" inside it) — it has no
  // reason to still be open once they're on the checkout page itself, and
  // sitting open on top of/behind the form is just visual clutter.
  useEffect(() => {
    closeCartDrawer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: siteInfo } = useSiteInfo();
  // Cached query — useCheckoutPrefill already reads it, so this is a cache
  // hit, not a second request.
  const { data: me } = useMe();
  // Defaults true (OTP required) until the setting loads, matching the
  // historical always-on behavior. Read through a ref rather than closing
  // over `siteInfo.codOtpEnabled` directly in the resolver below — the
  // resolver function's identity must stay stable for react-hook-form to
  // keep using it correctly, so it reads the *current* value at validation
  // time instead of the value from whichever render created it.
  const codOtpEnabledRef = useRef(true);
  codOtpEnabledRef.current = siteInfo?.codOtpEnabled ?? true;

  // An account with no phone is an email-identity customer — someone who
  // registered from outside Bangladesh, where we can't reach them by SMS.
  // The order's email becomes their only channel, so it stops being
  // optional. Read through a ref for the same reason as codOtpEnabled: the
  // resolver's identity must stay stable, so it reads the current value at
  // validation time rather than closing over whichever render made it.
  const requireEmailRef = useRef(false);
  requireEmailRef.current = !!me && !me.phone;

  // Assigned further down, once `cart` has loaded (the query is declared
  // below this form). Read through a ref for the same reason as the two
  // above: the resolver's identity must stay stable, so it reads the current
  // value at validation time.
  const digitalOnlyRef = useRef(false);

  const form = useForm<CheckoutFormValues>({
    resolver: (values, context, options) =>
      zodResolver(
        makeCheckoutFormSchema(codOtpEnabledRef.current, requireEmailRef.current, digitalOnlyRef.current),
      )(values, context, options),
    // Default mode is "onSubmit" — every field (phone/email included) only
    // ever validated after the first "Place Order" click, per explicit
    // report. "onBlur" validates a field the moment you leave it instead.
    // reValidateMode is set explicitly (not left to its documented
    // "onChange" default — verified live that it doesn't actually clear an
    // already-shown error until another blur without this) so a field that
    // failed validation clears its error the moment it's fixed, not only
    // after leaving and returning to it again.
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      shippingAddress: {
        recipientName: "",
        phone: "",
        alternativePhone: "",
        email: "",
        district: "",
        area: "",
        landmark: "",
        addressLine: "",
        postCode: "",
      },
      contact: { firstName: "", lastName: "", email: "", phone: "" },
      billingSameAsShipping: true,
      paymentProvider: "COD",
      codOtpCode: "",
      giftVoucherCode: "",
      customerNote: "",
      agreedToTerms: false,
    },
  });

  // Signed-in customers get their name/phone/email/address filled in for
  // them; guests are untouched. Only ever fills fields that are still empty
  // (see the hook) so it can't overwrite someone typing while it resolves.
  const { prefilledFromAddress, prefilledAddressId } = useCheckoutPrefill(form);

  // Saved addresses shown above the shipping fields for a signed-in
  // customer. `!!me` keeps the request off guest checkouts entirely — the
  // endpoint is CustomerJwtGuard-protected, so firing it without a session
  // is a guaranteed 401.
  const { data: savedAddressData } = useAddresses(!!me);
  // See SavedAddressPicker for why the generated AddressDto is wrong for
  // this endpoint and the real response shape is written out by hand.
  const savedAddresses = (savedAddressData ?? []) as unknown as SavedAddress[];

  // null means "typing a new one". Starts undefined so the prefill's own
  // choice can seed it once the query resolves, without overriding a
  // customer who has already picked a different card in the meantime.
  const [selectedAddressId, setSelectedAddressId] = useState<number | null | undefined>(undefined);
  const effectiveAddressId = selectedAddressId === undefined ? prefilledAddressId : selectedAddressId;

  // Clicking a card is an explicit instruction, so unlike the prefill hook
  // (which must never clobber typing) this overwrites — including blanking
  // the optional fields the chosen address leaves empty, or switching from
  // an address with a landmark to one without would keep the old landmark.
  function applySavedAddress(address: SavedAddress) {
    setSelectedAddressId(address.id);
    const next: Record<string, string> = {
      recipientName: address.recipientName,
      phone: address.phone,
      district: address.district,
      area: address.area ?? "",
      landmark: address.landmark ?? "",
      addressLine: address.addressLine,
      postCode: address.postCode ?? "",
    };
    for (const [key, value] of Object.entries(next)) {
      form.setValue(`shippingAddress.${key}` as "shippingAddress.recipientName", value, {
        shouldValidate: form.formState.isSubmitted,
        shouldDirty: true,
      });
    }
  }

  // Clears only the address itself. Name/phone/email stay: they belong to
  // the person ordering, not to the address, and someone shipping to a new
  // place is almost never also changing who they are.
  function useNewAddress() {
    setSelectedAddressId(null);
    for (const key of ["district", "area", "landmark", "addressLine", "postCode"]) {
      form.setValue(`shippingAddress.${key}` as "shippingAddress.district", "", {
        shouldValidate: false,
        shouldDirty: true,
      });
    }
  }

  const { register, control, handleSubmit, watch, formState } = form;
  const paymentProvider = watch("paymentProvider");
  const billingSameAsShipping = watch("billingSameAsShipping");
  const shippingPhone = watch("shippingAddress.phone");
  const shippingDistrict = watch("shippingAddress.district");

  // paymentProvider/shippingDistrict are threaded through so the previewed
  // total reflects the real shipping fee (Dhaka vs. outside-Dhaka) and COD
  // fee (Settings > Accounts) — the cart endpoint recomputes both per
  // computeCheckoutFees on the backend, so this always matches what
  // usePlaceOrder will actually charge.
  const { data: cart } = useCartQuery(locale, paymentProvider, shippingDistrict);

  // Every line is a digital product — the same rule the backend applies
  // (isDigitalOnly, orders/digital-order.util.ts). There is nothing to ship,
  // so no address, no shipping fee and no dispatch queue. A MIXED cart is
  // deliberately NOT digital-only: it still has a parcel in it, so it keeps
  // the physical behaviour exactly as before.
  const digitalOnly = (cart?.items.length ?? 0) > 0 && !!cart?.items.every((i) => i.productType === "DIGITAL");
  digitalOnlyRef.current = digitalOnly;
  // A ৳0 digital order has no payment step at all (the backend completes and
  // unlocks it immediately) — so nothing to choose a payment method for.
  const isFreeOrder = digitalOnly && Number(cart?.grandTotal ?? 0) === 0;

  // Same three rules as useCheckoutPrefill does for the address (never
  // clobber typing, guests untouched, run once) — but for the digital-only
  // "Your details" card, which that hook knows nothing about.
  const contactPrefilled = useRef(false);
  useEffect(() => {
    if (contactPrefilled.current || !me) return;
    contactPrefilled.current = true;
    const current = form.getValues("contact");
    const next = {
      firstName: current.firstName || me.firstName || "",
      lastName: current.lastName || me.lastName || "",
      email: current.email || me.email || "",
      phone: current.phone || me.phone || "",
    };
    for (const [key, value] of Object.entries(next)) {
      if (!value) continue;
      form.setValue(`contact.${key}` as "contact.firstName", value);
    }
  }, [me, form]);
  const updateItem = useUpdateCartItem(locale);
  const removeItem = useRemoveCartItem(locale);
  const placeOrder = usePlaceOrder(locale);
  const voucherCheck = useGiftVoucherCheck(voucherInput);
  const applyCoupon = useApplyCoupon(locale);
  const removeCoupon = useRemoveCoupon(locale);
  const addToCart = useAddToCart(locale);
  const [isAddingId, setIsAddingId] = useState<number | null>(null);
  const { data: methodConfigs } = usePaymentMethodConfigs();
  const [copied, setCopied] = useState(false);

  // begin_checkout — once per checkout page visit, as soon as real cart data
  // is available (not on every refetch triggered by paymentProvider/district
  // changing the previewed total, hence the ref guard).
  const firedBeginCheckout = useRef(false);
  useEffect(() => {
    if (firedBeginCheckout.current || !cart || cart.items.length === 0) return;
    firedBeginCheckout.current = true;
    pushEcommerceEvent(
      "begin_checkout",
      {
        currency: cart.currency,
        value: Number(cart.total),
        coupon: cart.couponCode ?? undefined,
        items: cart.items.map(cartLineToGa4Item),
      },
      addressToUserData(form.getValues("shippingAddress")),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart]);

  // add_payment_info — this checkout is a single page (no distinct
  // "shipping"/"payment" steps), so there's no page transition to hook;
  // fires whenever the payment method selection changes (including the
  // initial default on mount, which is itself a meaningful "customer has a
  // payment method staged" signal). `cart` is in the dependency array
  // because it loads asynchronously — on first render it's still
  // undefined, so the effect must re-run once it arrives — but the ref
  // guard stops that same load (or any later unrelated cart refetch, e.g.
  // a quantity change) from re-firing for a paymentProvider already fired.
  const firedPaymentType = useRef<string | null>(null);
  useEffect(() => {
    if (!cart || cart.items.length === 0 || firedPaymentType.current === paymentProvider) return;
    firedPaymentType.current = paymentProvider;
    pushEcommerceEvent(
      "add_payment_info",
      {
        currency: cart.currency,
        value: Number(cart.total),
        payment_type: paymentProvider,
        items: cart.items.map(cartLineToGa4Item),
      },
      addressToUserData(form.getValues("shippingAddress")),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentProvider, cart]);

  // add_shipping_info — same single-page-checkout caveat as add_payment_info
  // above; there's no distinct shipping step or shipping-tier choice
  // (single courier), so this fires once a real delivery district is
  // selected, as the closest available signal to "shipping info entered".
  const firedShippingInfo = useRef(false);
  useEffect(() => {
    if (firedShippingInfo.current || !shippingDistrict || !cart || cart.items.length === 0) return;
    firedShippingInfo.current = true;
    pushEcommerceEvent(
      "add_shipping_info",
      {
        currency: cart.currency,
        value: Number(cart.total),
        items: cart.items.map(cartLineToGa4Item),
      },
      addressToUserData(form.getValues("shippingAddress")),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingDistrict, cart]);

  // Bengali on both locales by explicit request — this is the one control on
  // the site whose wording the owner wants fixed regardless of the language
  // toggle. The grand total rides on the button so the amount being committed
  // to is visible at the moment of commitment, rather than only in the summary
  // above it (which is scrolled off-screen on a phone).
  // Rendered twice — once in the sidebar for desktop, once directly above the
  // submit on phones — because the mobile order the owner asked for is
  // summary -> add-ons -> terms -> submit, and terms lives inside the sidebar
  // card while the add-ons are a full-width row after it. No amount of CSS
  // `order` can slot a grid row between two children of the same column, so
  // the block itself moves instead.
  //
  // Safe to render twice: the checkbox is a react-hook-form `Controller`, so
  // both instances read and write the one `agreedToTerms` field rather than
  // holding separate state. Only one is ever visible at a given width.
  const renderTermsAgreement = (wrapperClass: string) => (
    <div className={wrapperClass}>
              <div className="mb-4 flex items-start gap-2.5">
                <Controller
                  name="agreedToTerms"
                  control={control}
                  render={({ field }) => <Checkbox checked={field.value} onCheckedChange={field.onChange} />}
                />
                <span className="font-body text-xs text-ink leading-relaxed">
                  {locale === "BN" ? (
                    <>
                      আমি{" "}
                      <Link href="/terms-conditions" target="_blank" className="font-medium text-header-green underline hover:text-green">
                        শর্তাবলী
                      </Link>
                      ,{" "}
                      <Link href="/privacy-policy" target="_blank" className="font-medium text-header-green underline hover:text-green">
                        গোপনীয়তা নীতি
                      </Link>{" "}
                      এবং{" "}
                      <Link href="/refund-policy" target="_blank" className="font-medium text-header-green underline hover:text-green">
                        রিটার্ন ও রিফান্ড নীতি
                      </Link>
                      -র সাথে সম্মত।
                    </>
                  ) : (
                    <>
                      I have read and agree to the{" "}
                      <Link href="/terms-conditions" target="_blank" className="font-medium text-header-green underline hover:text-green">
                        Terms and Conditions
                      </Link>
                      ,{" "}
                      <Link href="/privacy-policy" target="_blank" className="font-medium text-header-green underline hover:text-green">
                        Privacy Policy
                      </Link>{" "}
                      &amp;{" "}
                      <Link href="/refund-policy" target="_blank" className="font-medium text-header-green underline hover:text-green">
                        Refund and Return Policy
                      </Link>
                      .
                    </>
                  )}
                </span>
              </div>
              {formState.errors.agreedToTerms && (
                <p className="mb-3 font-body text-xs text-red-600">{formState.errors.agreedToTerms.message}</p>
              )}
    </div>
  );

  // Deselected add-ons, shared by both renders of CheckoutFbtSection below.
  const [fbtUnchecked, setFbtUnchecked] = useState<Set<number>>(() => new Set());
  const toggleFbt = (id: number) =>
    setFbtUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const placeOrderLabel = placeOrder.isPending
    ? "অর্ডার হচ্ছে…"
    : isFreeOrder
      ? "ফ্রিতে নিন"
      : cart
        ? `অর্ডার করুন — ${formatMoney(cart.grandTotal)}`
        : "অর্ডার করুন";

  const frequentlyBoughtCards = ((cart?.frequentlyBoughtTogether ?? []) as components["schemas"]["PublicProductDto"][])
    .map(toProductCardData)
    .filter((c) => !c.outOfStock);
  const crossSellCards = ((cart?.crossSellProducts ?? []) as components["schemas"]["PublicProductDto"][])
    .map(toProductCardData)
    .filter((c) => !c.outOfStock);

  function handleCardAddToCart(productId: number, packValue?: string) {
    setIsAddingId(productId);
    addToCart.mutate(
      { productId, variantId: packValue ? Number(packValue) : undefined },
      { onSettled: () => setIsAddingId(null) },
    );
  }

  async function handleAddMultipleCards(cardsToAdd: ProductCardData[]) {
    for (const card of cardsToAdd) {
      await addToCart.mutateAsync({
        productId: card.productId,
        variantId: card.defaultPackValue ? Number(card.defaultPackValue) : undefined,
        quantity: 1,
      });
    }
  }

  const manualOptions = (methodConfigs ?? [])
    .filter((c) => c.isActive)
    .map((c) => ({ value: c.provider, label: `${MANUAL_METHOD_LABELS[c.provider] ?? c.provider} — pay to ${c.number}` }));
  const paymentOptions = [STATIC_PAYMENT_OPTIONS[0], ...manualOptions, ...STATIC_PAYMENT_OPTIONS.slice(1)];
  const selectedMethodConfig = methodConfigs?.find((c) => c.provider === paymentProvider);

  if (placedOrder) {
    return (
      <div className="mx-auto max-w-[1180px] px-5 py-12">
        {/* The email/phone on this digital order already belongs to an
            account, so no session was issued — deliberately, see the
            account-takeover note on CheckoutAccountService.ensureAccount.
            Typing a stranger's email must never hand you their session, so
            the download goes to the mailbox that owns the account instead. */}
        {placedOrder.existingAccount && (
          <p className="mb-6 rounded-brand border border-line bg-beige p-4 text-center font-body text-sm text-ink">
            This email already has an account. We&apos;ve emailed your download link — {" "}
            <AppLink href="/login" className="text-green underline">
              sign in
            </AppLink>{" "}
            to see all your downloads.
          </p>
        )}
        <OrderConfirmation order={placedOrder} />
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="ghost" onClick={() => router.push("/products")}>
            Continue Shopping
          </Button>
          {digitalOnly && !placedOrder.existingAccount ? (
            <Button variant="green" onClick={() => router.push("/account/downloads")}>
              Go to My Downloads
            </Button>
          ) : (
            <Button variant="green" onClick={() => router.push("/track")}>
              Track Order
            </Button>
          )}
        </div>
      </div>
    );
  }

  const hasItems = (cart?.items.length ?? 0) > 0;

  async function onSubmit(values: CheckoutFormValues) {
    if (!hasItems) return;

    if (fraudResult?.verdict === "block") {
      setShowOtpPopup(false);
      setPreflightBlock({
        blocked: true,
        heading: "We could not accept this order",
        sub: "Don't worry, we can sort this out",
        reason: fraudResult.blockMessage?.en,
      });
      return;
    }

    setBlockPopupDismissed(false);
    placeOrder.mutate(
      {
        // A digital-only order has no address at all — the backend's own
        // guard only demands one when the cart is not digital-only, and
        // sending an empty one would fail its validators. `createAccount`
        // carries the buyer's name/email/phone in its place: it is what the
        // backend creates the passwordless account from, and also what feeds
        // the Net Profit blocker and the order email, which would otherwise
        // see no contact details for this order at all. Harmless when the
        // buyer is already signed in — checkout.service.ts only reads it when
        // there is no session.
        ...(digitalOnly
          ? {
              createAccount: {
                firstName: values.contact.firstName.trim(),
                lastName: values.contact.lastName.trim(),
                email: values.contact.email.trim() || undefined,
                phone: values.contact.phone.trim() || undefined,
              },
            }
          : {
              shippingAddress: cleanAddress(values.shippingAddress),
              billingAddress: values.billingSameAsShipping ? undefined : cleanAddress(values.billingAddress!),
            }),
        paymentProvider: values.paymentProvider,
        codOtpCode: !digitalOnly && values.paymentProvider === "COD" ? values.codOtpCode : undefined,
        giftVoucherCode: values.giftVoucherCode?.trim() || undefined,
        customerNote: values.customerNote?.trim() || undefined,
        deviceId: getDeviceId(),
        checkoutStartedAt: checkoutStartedAtRef.current,
        ...getUtmParamsForCheckout(),
      },
      {
        onSuccess: (order) => {
          // `existingAccount === false` is the ONLY signal that a session was
          // just issued: the backend returned a token pair and the
          // /api/backend proxy has already moved it into httpOnly cookies and
          // stripped it from this body (client JS can never read a token
          // here). Refetch `me` so AccountShell sees the new session instead
          // of the cached "logged out" answer and bouncing to /login.
          if (order.existingAccount === false) {
            queryClient.invalidateQueries({ queryKey: ["me"] });
            router.push("/account/downloads");
            return;
          }
          // `existingAccount === true` -> no cookies were set, by design.
          // Rendered as a notice on the confirmation screen below.
          // undefined -> physical order, or already signed in: unchanged.
          setPlacedOrder(order);
        },
      },
    );
  }

  // There's no inline COD-OTP field anywhere in the form — clicking "Place
  // Order" for a COD order always fails this specific zod check first try
  // (codOtpCode starts empty), which is exactly what opens the popup below.
  // Missing shipping fields take priority (checked first — earlier in the
  // form and more fundamental) and scroll into view instead. Not agreeing
  // to the terms takes priority over that too — a real bug this fixed:
  // codOtpCode is *always* invalid on a first COD submit regardless of the
  // terms checkbox, so without this check the OTP popup opened anyway even
  // with the terms error showing right there on the page, letting a
  // customer complete COD verification without ever having agreed to them.
  function onInvalid(errors: FieldErrors<CheckoutFormValues>) {
    // Digital-only: the address card isn't rendered, so the "Your details"
    // card takes its place as the fields to scroll back to. It shares the
    // same ref (only one of the two cards is ever mounted).
    if (errors.contact) {
      shippingAddressRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (errors.shippingAddress) {
      shippingAddressRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (errors.agreedToTerms) {
      return;
    }
    if (errors.codOtpCode) {
      setShowOtpPopup(true);
    }
  }

  const submitForm = handleSubmit(onSubmit, onInvalid);

  const blockDetails =
    placeOrder.error instanceof ProxyApiError &&
    !blockPopupDismissed &&
    isBlockDetails(placeOrder.error.details)
      ? placeOrder.error.details
      : null;

  // Same condition as the bottom-of-form error paragraph below — a block
  // is shown via BlockPopup instead, not as a plain error string.
  const placeOrderErrorMessage =
    placeOrder.isError && !blockDetails
      ? placeOrder.error instanceof Error
        ? placeOrder.error.message
        : "Couldn't place your order"
      : undefined;

  return (
    <FormProvider {...form}>
      <form onSubmit={submitForm} className="mx-auto max-w-[1180px] px-5 py-9">
        <h1 className="mb-1 text-center font-ui text-2xl font-bold text-ink">Checkout</h1>
        <p className="mb-6 text-center font-body text-sm text-muted">Home &gt; Checkout</p>

        {cart?.upsell && (
          <UpsellProgressBar
            stages={cart.upsell.stages}
            nextStage={cart.upsell.nextStage}
            currentCount={cart.upsell.currentCount}
            locale={locale}
            className="mb-6"
          />
        )}

        {hasItems && frequentlyBoughtCards.length > 0 && (
          <div className="mb-6 hidden md:block">
            <CheckoutFbtSection
              cards={frequentlyBoughtCards}
              onAddItems={handleAddMultipleCards}
              isPending={addToCart.isPending}
              unchecked={fbtUnchecked}
              onToggle={toggleFbt}
            />
          </div>
        )}

        {!hasItems && (
          <p className="mb-6 rounded-brand bg-beige p-4 text-center font-body text-sm text-ink">
            Your cart is empty — <AppLink href="/products" className="text-green underline">browse products</AppLink> to
            add something first.
          </p>
        )}

        <div className="grid grid-cols-2 gap-6 max-lg:grid-cols-1">
          <div>
            <div className="mb-5.5 rounded-brand border border-line bg-white p-5">
              <h2 className="mb-4 font-ui text-[15px] font-semibold text-green">Order Review</h2>
              {cart?.items.map((item) => (
                <CartLineItem
                  key={item.id}
                  item={{ ...item, href: `/products/${item.slug}`, imageUrl: toDisplayImageUrl(item.imageUrl, IMG.thumb) }}
                  onQuantityChange={(quantity) => updateItem.mutate({ itemId: item.id, quantity })}
                  onRemove={() => {
                    if (cart) {
                      pushEcommerceEvent("remove_from_cart", {
                        currency: cart.currency,
                        value: Number(item.lineTotal),
                        items: [cartLineToGa4Item(item)],
                      });
                    }
                    removeItem.mutate({ itemId: item.id });
                  }}
                  linkComponent={AppLink}
                />
              ))}
            </div>

            {/* Nothing is shipped on a digital-only order, so the whole
                address block — shipping card, shipping-rates notice and the
                billing card below it — is not rendered at all. The compact
                "Your details" card takes its place: the backend has no
                OrderAddress to read a name/email/phone from on this path
                (see CheckoutDto.createAccount). */}
            {digitalOnly ? (
              <div ref={shippingAddressRef} className="mb-5.5 rounded-brand border border-line bg-white p-5">
                <h2 className="mb-1 font-ui text-[15px] font-semibold text-green">Your details</h2>
                {!me && (
                  <p className="mb-4 font-body text-xs text-muted">
                    We&apos;ll create your account so you can download anytime.
                  </p>
                )}
                <div className="mb-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Input placeholder="First name" {...register("contact.firstName")} />
                    {formState.errors.contact?.firstName && (
                      <p className="mt-1 font-body text-xs text-red-600">{formState.errors.contact.firstName.message}</p>
                    )}
                  </div>
                  <div>
                    <Input placeholder="Last name" {...register("contact.lastName")} />
                    {formState.errors.contact?.lastName && (
                      <p className="mt-1 font-body text-xs text-red-600">{formState.errors.contact.lastName.message}</p>
                    )}
                  </div>
                </div>
                <div className="mb-3.5">
                  <Input type="email" placeholder="Email" {...register("contact.email")} />
                  {formState.errors.contact?.email && (
                    <p className="mt-1 font-body text-xs text-red-600">{formState.errors.contact.email.message}</p>
                  )}
                </div>
                <div className="mb-3.5">
                  <Input placeholder="Mobile number (optional)" {...register("contact.phone")} />
                  {formState.errors.contact?.phone && (
                    <p className="mt-1 font-body text-xs text-red-600">{formState.errors.contact.phone.message}</p>
                  )}
                </div>
                <div>
                  <textarea
                    rows={2}
                    placeholder="Note for your order (optional)"
                    className="w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 font-body text-sm outline-none focus:border-green"
                    {...register("customerNote")}
                  />
                </div>
              </div>
            ) : (
            <div ref={shippingAddressRef} className="mb-5.5 rounded-brand border border-line bg-white p-5">
              <h2 className="mb-4 font-ui text-[15px] font-semibold text-green">Shipping Address</h2>

              <SavedAddressPicker
                addresses={savedAddresses}
                selectedId={effectiveAddressId ?? null}
                onSelect={applySavedAddress}
                onUseNew={useNewAddress}
              />

              {/* Only worth saying when nothing above accounts for the filled
                  boxes — with the picker showing a selected card, the note
                  just repeats what the highlight already says. */}
              {prefilledFromAddress && savedAddresses.length === 0 && (
                <p className="mb-3.5 font-body text-xs text-muted">
                  Filled in from your saved address — edit anything that&apos;s changed.
                </p>
              )}
              <AddressFields
                prefix="shippingAddress"
                onFraudResult={setFraudResult}
                noteField={
                  <div className="mb-3.5">
                    <textarea
                      rows={2}
                      placeholder="Note for your order (optional)"
                      className="w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 font-body text-sm outline-none focus:border-green"
                      {...register("customerNote")}
                    />
                    {formState.errors.customerNote && (
                      <p className="mt-1 font-body text-xs text-red-600">{formState.errors.customerNote.message}</p>
                    )}
                  </div>
                }
              />
              {/* Reads the same zone config the backend charges from, so the
                  highlighted rate can never disagree with the Shipping fee
                  line in the order summary. */}
              <ShippingRatesNotice district={shippingDistrict} />
            </div>
            )}

            {!digitalOnly && (
            <div className="rounded-brand border border-line bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-ui text-[15px] font-semibold text-green">Billing Address</h2>
                <Checkbox
                  checked={billingSameAsShipping}
                  onCheckedChange={(checked) => form.setValue("billingSameAsShipping", checked)}
                  label="Same as shipping"
                />
              </div>
              {!billingSameAsShipping && (
                <div className="mt-4">
                  <AddressFields prefix="billingAddress" />
                </div>
              )}
            </div>
            )}
          </div>

          <div>
            {/* A ৳0 digital order has no payment step — the backend marks it
                paid and unlocks the file the moment it is placed — so there
                is nothing to pick a method for. A PRICED digital order still
                shows this card and uses the existing manual-payment flow. */}
            {!isFreeOrder && (
            <div className="mb-5.5 rounded-brand border border-line bg-white p-5">
              <h2 className="mb-4 font-ui text-[15px] font-semibold text-green">Payment Method</h2>
              <Controller
                name="paymentProvider"
                control={control}
                render={({ field }) => (
                  <PaymentMethodSelector
                    options={paymentOptions}
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      setCopied(false);
                    }}
                  />
                )}
              />

              {selectedMethodConfig && (
                <div className="mt-4 border-t border-line pt-4">
                  <div className="flex items-center gap-2">
                    <span className="font-body text-sm text-ink">
                      Send {cart ? formatMoney(cart.grandTotal) : ""} to{" "}
                      <span className="num font-semibold">{selectedMethodConfig.number}</span>
                      <span className="ml-1 text-xs text-muted">({selectedMethodConfig.accountType.toLowerCase()})</span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedMethodConfig.number).then(() => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        });
                      }}
                    >
                      {copied ? "Copied ✓" : "Copy number"}
                    </Button>
                  </div>
                  {(locale === "BN" ? selectedMethodConfig.instructionsBn : selectedMethodConfig.instructionsEn) && (
                    <p className="mt-2 font-body text-xs text-muted">
                      {locale === "BN" ? selectedMethodConfig.instructionsBn : selectedMethodConfig.instructionsEn}
                    </p>
                  )}
                  <p className="mt-2 font-body text-xs text-muted">
                    You&apos;ll enter your transaction ID on the confirmation page after placing this order.
                  </p>
                </div>
              )}
            </div>
            )}

            <div className="mb-5.5 rounded-brand border border-line bg-white p-5">
              <h2 className="mb-3 font-ui text-[15px] font-semibold text-green">Have a coupon or discount code?</h2>
              {cart?.couponCode ? (
                <div className="flex items-center justify-between rounded-lg bg-beige px-3 py-2">
                  <span className="font-ui text-xs font-medium text-ink">{cart.couponCode}</span>
                  <button
                    type="button"
                    onClick={() => removeCoupon.mutate(undefined)}
                    className="font-ui text-xs text-muted underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                // Plain div, not a nested <form> — the whole checkout page is
                // already one big <form> (react-hook-form's own submitForm,
                // above), and a <form> inside a <form> is invalid HTML. The
                // browser's parser dropped this inner form during the
                // initial SSR-HTML parse, which the client then detected as
                // a real hydration mismatch and reacted to by throwing away
                // and regenerating the whole tree — the actual reason
                // clicking Apply silently did nothing (no network request
                // ever fired) instead of erroring visibly.
                <div
                  className="flex gap-2"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (couponInput.trim()) applyCoupon.mutate({ code: couponInput.trim() });
                    }
                  }}
                >
                  <Input placeholder="Coupon / discount code" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (couponInput.trim()) applyCoupon.mutate({ code: couponInput.trim() });
                    }}
                  >
                    Apply
                  </Button>
                </div>
              )}
              {applyCoupon.isError && (
                <p className="mt-2 font-body text-xs text-red-600">
                  {applyCoupon.error instanceof Error ? applyCoupon.error.message : "Invalid coupon"}
                </p>
              )}
            </div>

            <div className="mb-5.5 rounded-brand border border-line bg-white p-5">
              <h2 className="mb-3 font-ui text-[15px] font-semibold text-green">Have a gift voucher?</h2>
              <div className="flex gap-2">
                <Input
                  placeholder="Gift voucher code"
                  {...register("giftVoucherCode", { onChange: (e) => setVoucherInput(e.target.value) })}
                />
              </div>
              {voucherCheck.data && (
                <p className={`mt-2 font-body text-xs ${voucherCheck.data.usable ? "text-green" : "text-red-600"}`}>
                  {voucherCheck.data.usable
                    ? `Valid — ${formatMoney(voucherCheck.data.remainingBalance)} available`
                    : "This voucher isn't usable"}
                </p>
              )}
              {voucherCheck.isError && (
                <p className="mt-2 font-body text-xs text-red-600">Voucher not found</p>
              )}
            </div>

            {cart && hasItems && (
              <div className="mb-5.5 rounded-brand border border-line bg-white p-5">
                <div className="flex justify-between py-1.5 font-body text-sm text-ink">
                  <span>Sub total</span>
                  <span>{formatMoney(cart.subTotal)}</span>
                </div>
                {cart.discounts.map((d, i) => (
                  <div key={i} className="flex justify-between py-1.5 font-body text-sm text-green">
                    <span>{d.label}</span>
                    <span>-{formatMoney(d.amount)}</span>
                  </div>
                ))}
                {Number(cart.shippingFee) > 0 && (
                  <div className="flex justify-between py-1.5 font-body text-sm text-ink">
                    <span>Shipping fee</span>
                    <span>{formatMoney(cart.shippingFee)}</span>
                  </div>
                )}
                {/* No tax/COD-fee row — per explicit request, neither is
                    ever charged to a customer (both are internal
                    accounting-only figures, see computeCheckoutFees in
                    apps/backend's accounts.service.ts); cart.taxAmount/
                    codFee are always "0" now, so there's nothing to show. */}
                <div className="flex justify-between border-t border-line py-1.5 pt-2.5 font-ui font-bold text-ink">
                  <span>Total</span>
                  <span>{formatMoney(cart.grandTotal)}</span>
                </div>
              </div>
            )}

            {renderTermsAgreement("hidden md:block")}

            {placeOrderErrorMessage && (
              <p className="mb-3 font-body text-sm text-red-600">{placeOrderErrorMessage}</p>
            )}

            {/* Desktop only. On a phone the submit lives below the add-ons
                section instead (see the md:hidden twin further down) — two
                submit buttons on one screen is just a second chance to hit the
                wrong one. Validation errors above stay visible at every width,
                since they belong to the form rather than to either button. */}
            <div className="hidden md:block">
              <Button type="submit" variant="green" block disabled={!hasItems || placeOrder.isPending}>
                {placeOrderLabel}
              </Button>
            </div>
          </div>

          {/* Phones only — sits between the order summary and the terms, which
              is the order the owner asked for. Desktop renders the same section
              directly under the upsell bar instead (above), where the page is
              wide enough for the equation row to read on one line. Only one is
              ever visible. */}
          {hasItems && frequentlyBoughtCards.length > 0 && (
            <div className="col-span-full mt-5 border-t border-line pt-5 md:hidden">
              <CheckoutFbtSection
                cards={frequentlyBoughtCards}
                onAddItems={handleAddMultipleCards}
                isPending={addToCart.isPending}
                unchecked={fbtUnchecked}
                onToggle={toggleFbt}
              />
            </div>
          )}

          {/* The submit on phones — the last thing on the page, after the
              add-ons, so nothing follows the decision to buy. Its desktop twin
              is in the sidebar above and is hidden below md; only one is ever
              on screen.

              Gated on `hasItems` alone and deliberately NOT nested inside the
              add-ons block above: a cart with no frequently-bought-together
              relations would otherwise leave a phone with no submit button at
              all, which is how this nearly shipped. */}
          {hasItems && (
            <div className="col-span-full mt-8 md:hidden">
              {renderTermsAgreement("")}
              <Button type="submit" variant="green" block disabled={placeOrder.isPending}>
                {placeOrderLabel}
              </Button>
            </div>
          )}
        </div>
      </form>
      {showOtpPopup && (
        <CodOtpPopup
          shippingPhone={shippingPhone}
          onConfirm={submitForm}
          onClose={() => setShowOtpPopup(false)}
          isSubmitting={placeOrder.isPending}
          errorMessage={placeOrderErrorMessage}
        />
      )}
      {blockDetails && <BlockPopup details={blockDetails} onClose={() => setBlockPopupDismissed(true)} />}
      {!blockDetails && preflightBlock && <BlockPopup details={preflightBlock} onClose={() => setPreflightBlock(null)} />}
    </FormProvider>
  );
}
