"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, FormProvider, useForm, type FieldErrors } from "react-hook-form";
import {
  Button,
  CartLineItem,
  Checkbox,
  Input,
  PaymentMethodSelector,
  UpsellProgressBar,
  formatMoney,
  useCartDrawerStore,
} from "@amader/ui";
import { useRouter } from "@/i18n/navigation";
import { AppLink } from "@/components/AppLink";
import { AddressFields } from "@/components/AddressFields";
import { OrderConfirmation } from "@/components/OrderConfirmation";
import { BlockPopup, type BlockPopupDetails } from "@/components/BlockPopup";
import { CodOtpPopup } from "@/components/CodOtpPopup";
import { toApiLocale } from "@/lib/api-locale";
import { toDisplayImageUrl } from "@/lib/media";
import { getDeviceId } from "@/lib/device-id";
import { getUtmParamsForCheckout } from "@/lib/utm";
import { ApiError } from "@/lib/api/client";
import { checkoutFormSchema, type CheckoutFormValues } from "@/lib/checkout-schema";
import { useApplyCoupon, useCartQuery, useRemoveCartItem, useRemoveCoupon, useUpdateCartItem } from "@/hooks/useCart";
import { useGiftVoucherCheck, usePlaceOrder } from "@/hooks/useCheckout";
import { usePaymentMethodConfigs } from "@/hooks/useManualPayment";
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

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
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
  const { data: methodConfigs } = usePaymentMethodConfigs();
  const [copied, setCopied] = useState(false);

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

        {cart?.upsell && <UpsellProgressBar stages={cart.upsell.stages} nextStage={cart.upsell.nextStage} className="mb-6" />}

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
                  onRemove={() => removeItem.mutate({ itemId: item.id })}
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
              <span className="font-body text-xs text-ink">
                I have read and agree to the Terms and Conditions, Privacy Policy &amp; Refund and Return Policy.
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
