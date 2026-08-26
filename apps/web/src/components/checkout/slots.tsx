"use client";

/**
 * The storefront's implementations of the package's checkout block schema.
 *
 * Each reads the brain from `useCheckoutContext()` and renders markup only --
 * no fetching, no business logic (plan §7.2 step 2). The markup was moved
 * verbatim out of DefaultCheckoutLayout, so a builder-composed checkout is
 * visually the same as the default one, block for block.
 *
 * Guards that used to live in the layout (`digitalOnly ? ...`,
 * `!isFreeOrder && ...`) moved INSIDE each block, so a block behaves correctly
 * wherever the owner drops it: a payment block on a free digital order still
 * renders nothing.
 */
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

import { CheckoutFbtSection, cn, toBnNum, MANUAL_METHOD_LABELS } from "./shared";

import type { CheckoutSlotMap } from "@amader/page-builder/config";
import { useCheckoutContext } from "./CheckoutContext";
import { CheckoutProductCard } from "./CheckoutProductCard";

function CheckoutOrderReview() {
  const { cart, removeItem, updateItem } = useCheckoutContext();
  return (
    <>
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
    </>
  );
}

function CheckoutContactDetails() {
  const { digitalOnly, formState, me, register, shippingAddressRef } = useCheckoutContext();
  if (!digitalOnly) return null;
  return (
    <>
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
    </>
  );
}

function CheckoutShippingAddress() {
  const { applySavedAddress, digitalOnly, effectiveAddressId, formState, prefilledFromAddress, register, savedAddresses, setFraudResult, shippingAddressRef, shippingDistrict, useNewAddress } = useCheckoutContext();
  if (digitalOnly) return null;
  return (
    <>
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
    </>
  );
}

function CheckoutBillingAddress() {
  const { billingSameAsShipping, digitalOnly, form } = useCheckoutContext();
  if (digitalOnly) return null;
  return (
    <>
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
    </>
  );
}

function CheckoutPaymentMethod() {
  const { cart, control, copied, isFreeOrder, locale, paymentOptions, selectedMethodConfig, setCopied } = useCheckoutContext();
  if (isFreeOrder) return null;
  return (
    <>
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
    </>
  );
}

function CheckoutCoupon() {
  const { applyCoupon, cart, couponInput, form, removeCoupon, setCouponInput } = useCheckoutContext();
  return (
    <>
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
    </>
  );
}

function CheckoutGiftVoucher() {
  const { register, setVoucherInput, voucherCheck } = useCheckoutContext();
  return (
    <>
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
    </>
  );
}

function CheckoutOrderSummary() {
  const { cart, hasItems } = useCheckoutContext();
  if (!cart || !hasItems) return null;
  return (
    <>
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
    </>
  );
}


/**
 * Blocks already extracted in the first 4b pass, kept here so the whole slot
 * map lives in one place.
 */
function CheckoutRootSlot({ main, sidebar }: Record<string, unknown>) {
  // Elements, not components: the package renders the slots on the server and
  // passes the result across the client boundary, because a function cannot
  // cross it.
  return (
    <div className="grid grid-cols-2 gap-6 max-lg:grid-cols-1">
      <div>{main as React.ReactNode}</div>
      <div>{sidebar as React.ReactNode}</div>
    </div>
  );
}

function CheckoutUpsellBar() {
  const { cart, locale } = useCheckoutContext();
  if (!cart?.upsell) return null;
  return (
    <UpsellProgressBar
      stages={cart.upsell.stages}
      nextStage={cart.upsell.nextStage}
      currentCount={cart.upsell.currentCount}
      locale={locale}
      className="mb-6"
    />
  );
}

function CheckoutFbt() {
  const {
    hasItems, frequentlyBoughtCards, handleAddMultipleCards,
    addToCart, fbtUnchecked, toggleFbt,
  } = useCheckoutContext();
  if (!hasItems || frequentlyBoughtCards.length === 0) return null;
  return (
    <CheckoutFbtSection
      cards={frequentlyBoughtCards}
      onAddItems={handleAddMultipleCards}
      isPending={addToCart.isPending}
      unchecked={fbtUnchecked}
      onToggle={toggleFbt}
    />
  );
}

function CheckoutTerms() {
  const { renderTermsAgreement } = useCheckoutContext();
  // No responsive class: in a builder layout the owner decides placement, so
  // the default layout's desktop/mobile split does not apply.
  return <>{renderTermsAgreement("")}</>;
}

function CheckoutPlaceOrder({ ctaLabel }: Record<string, unknown>) {
  const { placeOrder, placeOrderLabel, placeOrderErrorMessage, hasItems } =
    useCheckoutContext();
  if (!hasItems) return null;
  return (
    <>
      {placeOrderErrorMessage && (
        <p className="mb-3 font-body text-sm text-red-600">{placeOrderErrorMessage}</p>
      )}
      <Button type="submit" variant="green" block disabled={placeOrder.isPending}>
        {(typeof ctaLabel === "string" && ctaLabel.trim()) || placeOrderLabel}
      </Button>
    </>
  );
}

/**
 * CheckoutCustomerNote and CheckoutCrossSell are declared in the schema but
 * have no standalone markup in the default layout -- the note lives inside
 * AddressFields' noteField and the cross-sell was never rendered here. They
 * stay unimplemented rather than being invented, so they show as a labelled
 * placeholder if anyone drops one in.
 */
export const checkoutSlots: CheckoutSlotMap = {
  CheckoutRoot: CheckoutRootSlot,
  CheckoutUpsellBar,
  CheckoutFbt,
  CheckoutTerms,
  CheckoutPlaceOrder,
  CheckoutOrderReview,
  CheckoutContactDetails,
  CheckoutShippingAddress,
  CheckoutBillingAddress,
  CheckoutPaymentMethod,
  CheckoutCoupon,
  CheckoutGiftVoucher,
  CheckoutOrderSummary,
  // Sells one product straight from a landing page. Unlike every block above
  // it writes to the cart as well as reading it -- see the component.
  CheckoutProductCard,
};
