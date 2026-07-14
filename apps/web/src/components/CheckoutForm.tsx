"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, FormProvider, useForm } from "react-hook-form";
import {
  Button,
  CartLineItem,
  Checkbox,
  Input,
  PaymentMethodSelector,
  formatMoney,
} from "@amader/ui";
import { useRouter } from "@/i18n/navigation";
import { AppLink } from "@/components/AppLink";
import { AddressFields } from "@/components/AddressFields";
import { OrderConfirmation } from "@/components/OrderConfirmation";
import { toApiLocale } from "@/lib/api-locale";
import { toDisplayImageUrl } from "@/lib/media";
import { getDeviceId } from "@/lib/device-id";
import { checkoutFormSchema, type CheckoutFormValues } from "@/lib/checkout-schema";
import { useCartQuery, useRemoveCartItem, useUpdateCartItem } from "@/hooks/useCart";
import { useGiftVoucherCheck, usePlaceOrder, useRequestCodOtp } from "@/hooks/useCheckout";
import type { components } from "@/lib/api/schema";

const PAYMENT_OPTIONS = [
  { value: "COD", label: "Cash On Delivery" },
  { value: "BKASH", label: "bKash", disabledLabel: "Coming soon" },
  { value: "NAGAD", label: "Nagad", disabledLabel: "Coming soon" },
  { value: "SSLCOMMERZ", label: "Card / Online Payment", disabledLabel: "Coming soon" },
  { value: "BANK_TRANSFER", label: "Bank Transfer", disabledLabel: "Coming soon" },
];

function cleanAddress(address: components["schemas"]["CheckoutAddressDto"]) {
  return {
    ...address,
    email: address.email?.trim() ? address.email : undefined,
    area: address.area?.trim() || undefined,
    landmark: address.landmark?.trim() || undefined,
    postCode: address.postCode?.trim() || undefined,
  };
}

export function CheckoutForm() {
  const locale = toApiLocale(useLocale());
  const router = useRouter();
  const [placedOrder, setPlacedOrder] = useState<components["schemas"]["OrderDto"] | null>(null);
  const [codOtpSent, setCodOtpSent] = useState(false);
  const [voucherInput, setVoucherInput] = useState("");

  const { data: cart } = useCartQuery(locale);
  const updateItem = useUpdateCartItem(locale);
  const removeItem = useRemoveCartItem(locale);
  const requestCodOtp = useRequestCodOtp();
  const placeOrder = usePlaceOrder(locale);
  const voucherCheck = useGiftVoucherCheck(voucherInput);

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: {
      shippingAddress: {
        recipientName: "",
        phone: "",
        email: "",
        division: "",
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
    placeOrder.mutate(
      {
        shippingAddress: cleanAddress(values.shippingAddress),
        billingAddress: values.billingSameAsShipping ? undefined : cleanAddress(values.billingAddress!),
        paymentProvider: values.paymentProvider,
        codOtpCode: values.paymentProvider === "COD" ? values.codOtpCode : undefined,
        giftVoucherCode: values.giftVoucherCode?.trim() || undefined,
        customerNote: values.customerNote?.trim() || undefined,
        deviceId: getDeviceId(),
      },
      { onSuccess: (order) => setPlacedOrder(order) },
    );
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-[1180px] px-5 py-9">
        <h1 className="mb-1 text-center font-ui text-2xl font-bold text-ink">Checkout</h1>
        <p className="mb-6 text-center font-body text-sm text-muted">Home &gt; Checkout</p>

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

            <div className="mb-5.5 rounded-brand border border-line bg-white p-5">
              <h2 className="mb-4 font-ui text-[15px] font-semibold text-green">Shipping Address</h2>
              <AddressFields prefix="shippingAddress" />
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
                  <PaymentMethodSelector options={PAYMENT_OPTIONS} value={field.value} onChange={field.onChange} />
                )}
              />

              {paymentProvider === "COD" && (
                <div className="mt-4 border-t border-line pt-4">
                  <p className="mb-2 font-body text-xs text-muted">
                    We&apos;ll text a verification code to {shippingPhone || "your shipping phone number"}.
                  </p>
                  <div className="flex gap-2">
                    <Input placeholder="Enter OTP code" {...register("codOtpCode")} />
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={!shippingPhone || requestCodOtp.isPending}
                      onClick={() => requestCodOtp.mutate(shippingPhone, { onSuccess: () => setCodOtpSent(true) })}
                    >
                      {codOtpSent ? "Resend OTP" : "Send OTP"}
                    </Button>
                  </div>
                  {formState.errors.codOtpCode && (
                    <p className="mt-1 font-body text-xs text-red-600">{formState.errors.codOtpCode.message}</p>
                  )}
                </div>
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
                <div className="flex justify-between py-1.5 font-ui font-bold text-ink">
                  <span>Total</span>
                  <span>{formatMoney(cart.total)}</span>
                </div>
              </div>
            )}

            <div className="mb-5.5 rounded-brand border border-line bg-white p-5">
              <h2 className="mb-3 font-ui text-[15px] font-semibold text-green">Special notes (Optional)</h2>
              <textarea
                rows={2}
                className="w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 font-body text-sm outline-none focus:border-green"
                {...register("customerNote")}
              />
            </div>

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

            {placeOrder.isError && (
              <p className="mb-3 font-body text-sm text-red-600">
                {placeOrder.error instanceof Error ? placeOrder.error.message : "Couldn't place your order"}
              </p>
            )}

            <Button type="submit" variant="gold" block disabled={!hasItems || placeOrder.isPending}>
              {placeOrder.isPending ? "Placing Order…" : "Place Order"}
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
