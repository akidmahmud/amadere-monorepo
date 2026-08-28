"use client";

"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, FormProvider, useForm, useWatch, type FieldErrors } from "react-hook-form";
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
import { useGiftVoucherCheck, usePlaceOrder, useRecordCheckoutAbandonment } from "@/hooks/useCheckout";
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

import {
  isBlockDetails,
  MANUAL_METHOD_LABELS,
  STATIC_PAYMENT_OPTIONS,
  cleanAddress,
  cn,
} from "./shared";

/**
 * The checkout brain: form state, cart, payment, analytics, submission.
 *
 * Lifted out of CheckoutForm unchanged (plan §7.2 step 1). Every line below
 * was moved verbatim -- this step is a pure refactor, so any behavioural
 * difference here would be a bug rather than an improvement.
 *
 * A hook, not a component, so the context can be typed as
 * ReturnType<typeof useCheckoutState> and the markup keeps every prop type
 * it had while it lived in the same file.
 */
export function useCheckoutState() {
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
  // Two independent reasons to require a code: the shop demands one from every
  // COD customer (siteInfo), or the fraud pre-flight came back saying THIS
  // customer is below the accept threshold (Fraud > "Require OTP for risky
  // customers"). The backend re-derives the same thing at order time, so this
  // only controls whether the popup is shown, never whether it is enforced.
  codOtpEnabledRef.current =
    (siteInfo?.codOtpEnabled ?? true) || fraudResult?.requiresOtp === true;

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

  /**
   * Abandonment beacon — records who this shopper is while they are still
   * filling the form, so an abandoned cart has someone to contact.
   *
   * Debounced and de-duplicated on the values themselves: this fires from a
   * form the shopper is actively typing into, and one row per keystroke would
   * be both useless and expensive. It sends only once a phone or an email is
   * actually present, because a name alone is not something anyone can be
   * reached on.
   *
   * Not tied to submit, on purpose — the shopper who submits is the one case
   * this is NOT about.
   */
  const recordAbandonment = useRecordCheckoutAbandonment();
  const lastBeacon = useRef("");
  const watchedName = useWatch({ control: form.control, name: "shippingAddress.recipientName" });
  const watchedPhone = useWatch({ control: form.control, name: "shippingAddress.phone" });
  const watchedEmail = useWatch({ control: form.control, name: "shippingAddress.email" });
  useEffect(() => {
    const name = watchedName?.trim() || undefined;
    const phone = watchedPhone?.trim() || undefined;
    const email = watchedEmail?.trim() || undefined;
    if (!phone && !email) return;
    const key = `${name ?? ""}|${phone ?? ""}|${email ?? ""}`;
    if (key === lastBeacon.current) return;
    const timer = setTimeout(() => {
      lastBeacon.current = key;
      recordAbandonment.mutate({ name, phone, email });
    }, 1500);
    return () => clearTimeout(timer);
    // recordAbandonment is a stable mutation object; including it would
    // re-arm the timer on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedName, watchedPhone, watchedEmail]);

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


  return {
    placedOrder,
    addToCart,
    applyCoupon,
    applySavedAddress,
    billingSameAsShipping,
    blockDetails,
    cart,
    control,
    copied,
    couponInput,
    digitalOnly,
    effectiveAddressId,
    fbtUnchecked,
    form,
    formState,
    frequentlyBoughtCards,
    handleAddMultipleCards,
    hasItems,
    isFreeOrder,
    locale,
    me,
    onSubmit,
    paymentOptions,
    placeOrder,
    placeOrderErrorMessage,
    placeOrderLabel,
    prefilledFromAddress,
    preflightBlock,
    register,
    removeCoupon,
    removeItem,
    renderTermsAgreement,
    savedAddresses,
    selectedMethodConfig,
    setBlockPopupDismissed,
    setCopied,
    setCouponInput,
    setFraudResult,
    setPreflightBlock,
    setShowOtpPopup,
    setVoucherInput,
    shippingAddressRef,
    shippingDistrict,
    shippingPhone,
    showOtpPopup,
    submitForm,
    toggleFbt,
    updateItem,
    useNewAddress,
    voucherCheck,
  };
}
