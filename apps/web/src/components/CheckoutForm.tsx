"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
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
import { toDisplayImageUrl } from "@/lib/media";
import { toProductCardData, type ProductCardData } from "@/lib/product-card-mapper";
import { pushEcommerceEvent, cartLineToGa4Item } from "@/lib/analytics-events";
import { getDeviceId } from "@/lib/device-id";
import { getUtmParamsForCheckout } from "@/lib/utm";
import { ApiError } from "@/lib/api/client";
import { makeCheckoutFormSchema, type CheckoutFormValues } from "@/lib/checkout-schema";
import { useAddToCart, useApplyCoupon, useCartQuery, useRemoveCartItem, useRemoveCoupon, useUpdateCartItem } from "@/hooks/useCart";
import { useGiftVoucherCheck, usePlaceOrder } from "@/hooks/useCheckout";
import { usePaymentMethodConfigs } from "@/hooks/useManualPayment";
import { useSiteInfo } from "@/hooks/useSiteInfo";
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

function CheckoutFbtSection({
  cards,
  onAddItems,
  isPending,
}: {
  cards: ProductCardData[];
  onAddItems: (cardsToAdd: ProductCardData[]) => void;
  isPending?: boolean;
}) {
  const [checked, setChecked] = useState<Set<number>>(() => new Set(cards.map((c) => c.productId)));

  if (cards.length === 0) return null;

  const checkedCards = cards.filter((c) => checked.has(c.productId));
  const total = checkedCards.reduce((sum, c) => sum + Number(c.price), 0);
  const originalTotal = checkedCards.reduce(
    (sum, c) => sum + (c.originalPrice ? Number(c.originalPrice) : Number(c.price)),
    0,
  );
  const saved = Math.max(0, originalTotal - total);
  const savingsPercent = originalTotal > 0 && saved > 0 ? Math.round((saved / originalTotal) * 100) : 0;

  function toggle(id: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="w-full">
      {/* Outer Card Container */}
      <section className="rounded-3xl border border-[#E5EFE7] bg-white p-5 sm:p-6 md:p-8 shadow-sm">
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* Basket Circle Icon */}
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-full bg-[#E5F5EB] text-[#008400]">
              <svg className="h-6 w-6 sm:h-7 sm:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <div>
              <h2 className="font-ui text-xl sm:text-2xl font-extrabold text-[#1E293B] leading-tight">
                অন্যরাও সাথে নিয়েছেন
              </h2>
              <p className="mt-0.5 font-body text-xs sm:text-sm font-medium text-[#64748B]">
                একসাথে নিলে বেশি সাশ্রয়! নিচের আইটেমগুলো একসাথে নিন এবং বাঁচান।
              </p>
            </div>
          </div>

          {/* Savings Badge */}
          <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-[#D5ECCF] bg-[#ECF7EE] px-4 py-2 text-sm font-bold text-[#008400] shrink-0">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span>সাশ্রয় করুন</span>
          </div>
        </div>

        {/* Product Cards Row / Grid */}
        <div className="my-6 flex flex-col gap-4 md:flex-row md:items-center">
          {cards.map((card, index) => {
            const isChecked = checked.has(card.productId);
            return (
              <Fragment key={card.productId}>
                {index > 0 && (
                  <div className="hidden md:flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#CDE5D4] bg-white text-[#008400] font-bold text-lg shadow-sm">
                    +
                  </div>
                )}
                <div
                  className={cn(
                    "relative flex flex-col justify-between rounded-2xl border-2 bg-white p-4 shadow-sm transition-all flex-1 min-w-0 min-h-[250px]",
                    isChecked ? "border-[#008400] shadow-md bg-white" : "border-[#E5E5E5] hover:border-slate-300"
                  )}
                >
                  {/* Product Image */}
                  <AppLink href={card.href} className="block h-36 w-full shrink-0 overflow-hidden rounded-xl bg-[#F8F9FA] p-2 mb-3">
                    {card.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.imageUrl} alt={card.name} loading="lazy" className="h-full w-full object-contain" />
                    )}
                  </AppLink>

                  {/* Title */}
                  <p className="font-ui text-xs sm:text-sm font-bold text-[#1E293B] line-clamp-2 mb-3 leading-snug flex-1" title={card.name}>
                    {card.name}
                  </p>

                  {/* Bottom Price & Checkbox Row */}
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
                    <span className="font-ui text-base font-extrabold text-[#008400]">
                      ৳{toBnNum(formatMoney(card.price).replace("৳", "").trim())}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggle(card.productId)}
                      aria-label={`Toggle ${card.name}`}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg border-2 transition-all cursor-pointer",
                        isChecked ? "border-[#008400] bg-[#008400] text-white shadow-xs" : "border-slate-300 bg-white text-transparent hover:border-slate-400"
                      )}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </Fragment>
            );
          })}

          <div className="hidden md:flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#CDE5D4] bg-white text-[#008400] font-bold text-lg shadow-sm">
            =
          </div>
        </div>

        {/* Bottom Total Summary Box */}
        <div className="rounded-2xl border border-[#E0EFE4] bg-[#F2FAF4] p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-5">
          {/* Left Side (Total Price & Savings) */}
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-full bg-[#DFF3E6] text-[#008400]">
              <svg className="h-6 w-6 sm:h-7 sm:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-ui text-2xl sm:text-3xl font-extrabold text-[#008400]">
                  ৳{toBnNum(total.toFixed(0))}
                </span>
                {saved > 0 && (
                  <span className="font-ui text-sm sm:text-base font-semibold text-[#94A3B8] line-through">
                    ৳{toBnNum(originalTotal.toFixed(0))}
                  </span>
                )}
              </div>
              {saved > 0 && (
                <div className="mt-1 inline-flex items-center rounded-full bg-[#008400] px-3 py-0.5 text-xs font-bold text-white shadow-2xs">
                  Save ৳{toBnNum(saved.toFixed(0))} ({toBnNum(savingsPercent)}%)
                </div>
              )}
            </div>
          </div>

          {/* Right Side (CTA Button & Security Note) */}
          <div className="flex flex-col items-center sm:items-end gap-2 w-full sm:w-auto">
            <button
              type="button"
              disabled={isPending || checkedCards.length === 0}
              onClick={() => onAddItems(checkedCards)}
              className="flex w-full sm:w-auto min-w-[240px] items-center justify-center gap-3 rounded-xl bg-[#1B753C] hover:bg-[#155C2F] text-white px-6 py-3.5 font-bold text-base transition-all shadow-md active:scale-98 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>{isPending ? "যোগ হচ্ছে…" : `কার্টে যোগ করুন (${toBnNum(checkedCards.length)})`}</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#008400]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>১০০% নিরাপদ পেমেন্ট</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function CheckoutForm() {
  const locale = toApiLocale(useLocale());
  const router = useRouter();
  const [placedOrder, setPlacedOrder] = useState<components["schemas"]["OrderDto"] | null>(null);
  const [voucherInput, setVoucherInput] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [blockPopupDismissed, setBlockPopupDismissed] = useState(false);
  const [fraudResult, setFraudResult] = useState<FraudPreflightResult | null>(null);
  const [preflightBlock, setPreflightBlock] = useState<BlockPopupDetails | null>(null);
  const [showOtpPopup, setShowOtpPopup] = useState(false);
  const checkoutStartedAtRef = useRef(Math.floor(Date.now() / 1000));
  const shippingAddressRef = useRef<HTMLDivElement>(null);
  const closeCartDrawer = useCartDrawerStore((s) => s.close);

  // The cart drawer can be left open from wherever the customer clicked
  // through to checkout from (e.g. "View Cart" inside it) — it has no
  // reason to still be open once they're on the checkout page itself, and
  // sitting open on top of/behind the form is just visual clutter.
  useEffect(() => {
    closeCartDrawer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: siteInfo } = useSiteInfo();
  // Defaults true (OTP required) until the setting loads, matching the
  // historical always-on behavior. Read through a ref rather than closing
  // over `siteInfo.codOtpEnabled` directly in the resolver below — the
  // resolver function's identity must stay stable for react-hook-form to
  // keep using it correctly, so it reads the *current* value at validation
  // time instead of the value from whichever render created it.
  const codOtpEnabledRef = useRef(true);
  codOtpEnabledRef.current = siteInfo?.codOtpEnabled ?? true;

  const form = useForm<CheckoutFormValues>({
    resolver: (values, context, options) =>
      zodResolver(makeCheckoutFormSchema(codOtpEnabledRef.current))(values, context, options),
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
      billingSameAsShipping: true,
      paymentProvider: "COD",
      codOtpCode: "",
      giftVoucherCode: "",
      customerNote: "",
      agreedToTerms: false,
    },
  });

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
    pushEcommerceEvent("begin_checkout", {
      currency: cart.currency,
      value: Number(cart.total),
      coupon: cart.couponCode ?? undefined,
      items: cart.items.map(cartLineToGa4Item),
    });
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
    pushEcommerceEvent("add_payment_info", {
      currency: cart.currency,
      value: Number(cart.total),
      payment_type: paymentProvider,
      items: cart.items.map(cartLineToGa4Item),
    });
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
    pushEcommerceEvent("add_shipping_info", {
      currency: cart.currency,
      value: Number(cart.total),
      items: cart.items.map(cartLineToGa4Item),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingDistrict, cart]);

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
        <OrderConfirmation order={placedOrder} />
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="ghost" onClick={() => router.push("/products")}>
            Continue Shopping
          </Button>
          <Button variant="green" onClick={() => router.push("/track")}>
            Track Order
          </Button>
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
        shippingAddress: cleanAddress(values.shippingAddress),
        billingAddress: values.billingSameAsShipping ? undefined : cleanAddress(values.billingAddress!),
        paymentProvider: values.paymentProvider,
        codOtpCode: values.paymentProvider === "COD" ? values.codOtpCode : undefined,
        giftVoucherCode: values.giftVoucherCode?.trim() || undefined,
        customerNote: values.customerNote?.trim() || undefined,
        deviceId: getDeviceId(),
        checkoutStartedAt: checkoutStartedAtRef.current,
        ...getUtmParamsForCheckout(),
      },
      { onSuccess: (order) => setPlacedOrder(order) },
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
    placeOrder.error instanceof ApiError && !blockPopupDismissed && isBlockDetails(placeOrder.error.details)
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
                  item={{ ...item, href: `/products/${item.slug}`, imageUrl: toDisplayImageUrl(item.imageUrl) }}
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

            <div ref={shippingAddressRef} className="mb-5.5 rounded-brand border border-line bg-white p-5">
              <h2 className="mb-4 font-ui text-[15px] font-semibold text-green">Shipping Address</h2>
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
            </div>

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
          </div>

          <div>
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

            {placeOrderErrorMessage && (
              <p className="mb-3 font-body text-sm text-red-600">{placeOrderErrorMessage}</p>
            )}

            <Button type="submit" variant="green" block disabled={!hasItems || placeOrder.isPending}>
              {placeOrder.isPending ? "Placing Order…" : "Place Order"}
            </Button>
          </div>

          {/* Bottom Recommendations: Frequently Bought Together & Cross Sell */}
          {hasItems && (frequentlyBoughtCards.length > 0 || crossSellCards.length > 0) && (
            <div className="col-span-full mt-10 space-y-10 border-t border-line pt-10">
              {frequentlyBoughtCards.length > 0 && (
                <CheckoutFbtSection
                  cards={frequentlyBoughtCards}
                  onAddItems={handleAddMultipleCards}
                  isPending={addToCart.isPending}
                />
              )}

              {crossSellCards.length > 0 && (
                <section>
                  <h2 className="mb-4 font-ui text-lg font-bold text-green md:text-xl">
                    সাথে নিতে পারেন
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {crossSellCards.map((card) => (
                      <SiteProductCard
                        key={card.productId}
                        {...card}
                        linkComponent={AppLink}
                        onAddToCart={(packValue) => handleCardAddToCart(card.productId, packValue)}
                        addToCartPending={addToCart.isPending && isAddingId === card.productId}
                      />
                    ))}
                  </div>
                </section>
              )}
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
