"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CartDrawer,
  CartCrossSellRow,
  CartLineItem,
  FreeShippingLadder,
  Button,
  Input,
  formatMoney,
} from "@amader/ui";
import { useRouter } from "@/i18n/navigation";
import { AppLink } from "@/components/AppLink";
import { toApiLocale } from "@/lib/api-locale";
import { toDisplayImageUrl } from "@/lib/media";
import {
  useApplyCoupon,
  useCartQuery,
  useRemoveCartItem,
  useRemoveCoupon,
  useUpdateCartItem,
  useAddToCart,
} from "@/hooks/useCart";

export function SiteCartDrawer() {
  const t = useTranslations("cart");
  const router = useRouter();
  const locale = toApiLocale(useLocale());
  const [couponInput, setCouponInput] = useState("");

  const { data: cart } = useCartQuery(locale);
  const updateItem = useUpdateCartItem(locale);
  const removeItem = useRemoveCartItem(locale);
  const applyCoupon = useApplyCoupon(locale);
  const removeCoupon = useRemoveCoupon(locale);
  const addToCart = useAddToCart(locale);

  const hasItems = (cart?.items.length ?? 0) > 0;

  return (
    <CartDrawer
      title={t("title")}
      emptyLabel={t("empty")}
      checkoutLabel={t("checkout")}
      closeLabel={t("close")}
      subtotalLabel={t("subtotal")}
      subtotal={hasItems && cart ? formatMoney(cart.total) : undefined}
      onCheckout={() => router.push("/checkout")}
    >
      {hasItems && cart && (
        <div>
          {cart.freeShipping && (
            <FreeShippingLadder
              threshold={cart.freeShipping.threshold}
              remaining={cart.freeShipping.remaining}
              className="mb-3"
            />
          )}

          {cart.items.map((item) => (
            <CartLineItem
              key={item.id}
              item={{ ...item, href: `/products/${item.slug}`, imageUrl: toDisplayImageUrl(item.imageUrl) }}
              onQuantityChange={(quantity) => updateItem.mutate({ itemId: item.id, quantity })}
              onRemove={() => removeItem.mutate({ itemId: item.id })}
              linkComponent={AppLink}
            />
          ))}

          {cart.discounts.length > 0 && (
            <div className="space-y-1 border-b border-line py-3">
              {cart.discounts.map((d, i) => (
                <div key={i} className="flex justify-between font-body text-xs text-green">
                  <span>{d.label}</span>
                  <span>-{formatMoney(d.amount)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="py-3">
            {cart.couponCode ? (
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
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (couponInput.trim()) applyCoupon.mutate({ code: couponInput.trim() });
                }}
              >
                <Input
                  placeholder="Coupon code"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                />
                <Button type="submit" variant="ghost" size="md">
                  Apply
                </Button>
              </form>
            )}
            {applyCoupon.isError && (
              <p className="mt-1.5 font-body text-xs text-red-600">
                {applyCoupon.error instanceof Error ? applyCoupon.error.message : "Invalid coupon"}
              </p>
            )}
          </div>

          <CartCrossSellRow
            heading="Frequently Added Together"
            items={cart.crossSell.map((c) => ({ ...c, href: `/products/${c.slug}`, imageUrl: toDisplayImageUrl(c.imageUrl) }))}
            onAdd={(productId) => addToCart.mutate({ productId })}
            linkComponent={AppLink}
          />
        </div>
      )}
    </CartDrawer>
  );
}
