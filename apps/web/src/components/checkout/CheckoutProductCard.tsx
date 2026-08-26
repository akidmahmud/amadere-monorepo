"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Controller, useWatch } from "react-hook-form";
import { Button, Select, formatMoney } from "@amader/ui";
import { BD_DISTRICTS_BY_DIVISION, BD_THANAS_BY_DISTRICT } from "@amader/shared";
import { proxyFetch } from "@/lib/api/proxy-client";
import { useCheckoutContext } from "./CheckoutContext";

/**
 * A one-product order card for a landing page — pack picker, quantity, live
 * bill, and the customer's details — submitting through the REAL checkout.
 *
 * There is no second order path here. The fields are the same react-hook-form
 * fields `/checkout` uses, the submit is the provider's own `submitForm`, and
 * the COD OTP popup, fraud preflight and block popups are rendered by the
 * provider above. A visitor ordering from a landing page and one ordering from
 * /checkout go through identical validation and create identical orders.
 *
 * Packs and prices are read live from the product, never copied into the
 * block: a price edited in Products must not leave a landing page quoting the
 * old number.
 */

/** Same flattened, sorted list AddressFields uses, so the two agree. */
const DISTRICT_OPTIONS = Object.values(BD_DISTRICTS_BY_DIVISION)
  .flat()
  .sort((a, b) => a.localeCompare(b))
  .map((d) => ({ value: d, label: d }));

interface PackOption {
  value: string;
  label: string;
  price: string;
  originalPrice?: string;
  outOfStock?: boolean;
}

/**
 * The real public product shape, confirmed against the API rather than
 * assumed. Three details matter and all three were wrong on the first pass:
 * the pack labels live in `attributeValues[].value` (not `attributes`), the
 * price a customer pays is `salePrice` when set (with `price` as the struck-
 * through original), and stock is a `stockStatus` string, not a boolean. Get
 * any of them wrong and the card renders three identically-labelled packs at
 * the wrong prices -- which looks plausible enough to ship.
 */
interface ProductMedia {
  url?: string;
  cardUrl?: string;
  type?: string;
  isPrimary?: boolean;
  /** Set when the shop has assigned this image to one specific pack. */
  variantId?: number | null;
}

interface ProductLite {
  id: number;
  name: string;
  media?: ProductMedia[];
  price?: string | null;
  salePrice?: string | null;
  variants?: {
    id: number;
    sku?: string | null;
    price?: string | null;
    salePrice?: string | null;
    stockStatus?: string;
    attributeValues?: { value?: string }[];
  }[];
}

/**
 * The image to show for the pack currently chosen.
 *
 * A shop CAN assign an image per pack (media rows carry `variantId`), so that
 * is preferred — pick the 1kg tin and you see the 1kg tin. Most products have
 * not assigned any, so it falls back to the primary product image rather than
 * showing nothing.
 */
function pickImage(
  product: ProductLite | undefined,
  variantId: string | null,
): string | null {
  const media = (product?.media ?? []).filter((m) => m.type !== "VIDEO");
  if (media.length === 0) return null;
  const vid = variantId ? Number(variantId) : null;
  const forVariant = vid ? media.find((m) => m.variantId === vid) : undefined;
  const chosen = forVariant ?? media.find((m) => m.isPrimary) ?? media[0];
  // cardUrl is the pre-resized derivative; `url` is the original and would ship
  // a full-size image into a 96px box.
  return chosen?.cardUrl ?? chosen?.url ?? null;
}

/** salePrice wins when it is genuinely lower — matches product-card-mapper. */
function effective(price?: string | null, salePrice?: string | null) {
  const onSale =
    salePrice != null && price != null && Number(salePrice) < Number(price);
  return {
    price: (onSale ? salePrice : price) ?? "0",
    originalPrice: onSale ? (price ?? undefined) : undefined,
  };
}

function toPacks(p: ProductLite | undefined): PackOption[] {
  if (!p) return [];
  if (!p.variants?.length) {
    return [{ value: "", label: p.name, ...effective(p.price, p.salePrice) }];
  }
  return p.variants.map((v) => ({
    value: String(v.id),
    label:
      v.attributeValues?.map((a) => a.value).filter(Boolean).join(" / ") ||
      v.sku ||
      p.name,
    ...effective(v.price, v.salePrice),
    outOfStock: v.stockStatus === "OUT_OF_STOCK",
  }));
}

export function CheckoutProductCard({
  productSlug,
  heading,
  subheading,
  ctaLabel,
  whatsappNumber,
  showImage,
}: Record<string, unknown>) {
  const {
    cart,
    locale,
    register,
    formState,
    addToCart,
    updateItem,
    placeOrder,
    placeOrderLabel,
    placeOrderErrorMessage,
    renderTermsAgreement,
    control,
    submitForm,
    hasItems,
  } = useCheckoutContext();

  // District drives the thana list AND the shipping fee, so the card has to
  // collect it. The pasted design had only a free-text address, but an order
  // cannot be costed or dispatched without a district -- submitting silently
  // failed validation on a field that was not on screen, which is the worst
  // version of this bug.
  const district = useWatch({ control, name: "shippingAddress.district" });
  const thanas = district ? BD_THANAS_BY_DISTRICT[district] : undefined;

  const slug = typeof productSlug === "string" ? productSlug.trim() : "";

  const { data: product, isLoading } = useQuery({
    queryKey: ["landing-product", slug, locale],
    queryFn: () =>
      proxyFetch<ProductLite>(`/products/${slug}?locale=${locale}`),
    enabled: !!slug,
  });

  const packs = useMemo(() => toPacks(product), [product]);
  const [packValue, setPackValue] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const selected = packs.find((p) => p.value === packValue) ?? packs[0];
  const image = pickImage(product, packValue);

  // The cart line this card created, so changing pack or quantity edits that
  // line instead of stacking another copy each time the visitor changes their
  // mind.
  const lineIdRef = useRef<number | null>(null);
  const syncing = useRef(false);

  /**
   * Submit is deferred until the cart actually holds the chosen pack.
   *
   * `onSubmit` opens with `if (!hasItems) return`, and `submitForm` is built
   * during render -- so calling it straight after awaiting the add captured a
   * closure that still saw an EMPTY cart and returned silently. No validation
   * error, no network call, a button that looked ignored. Waiting for
   * `hasItems` to flip means the submit runs against a render that can see the
   * item.
   */
  /**
   * Picking a pack or changing quantity updates the CART immediately, so the
   * bill below is live.
   *
   * Without this the selection only moved local state and nothing reached the
   * cart until Confirm, so the totals sat at zero and the pack buttons looked
   * broken -- the visitor clicks, and nothing anywhere on the card changes.
   *
   * Skipped on mount: merely landing on a landing page must not put anything
   * in someone's cart. Only a deliberate pick does.
   */
  const interacted = useRef(false);
  useEffect(() => {
    if (!interacted.current) return;
    void syncToCart();
    // syncToCart reads the current pack/qty from state; re-running it on every
    // identity change would loop against the cart refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packValue, qty]);

  const [pendingSubmit, setPendingSubmit] = useState(false);
  useEffect(() => {
    if (!pendingSubmit || !hasItems) return;
    setPendingSubmit(false);
    void submitForm();
  }, [pendingSubmit, hasItems, submitForm]);

  useEffect(() => {
    if (packs.length && packValue === null) setPackValue(packs[0].value);
  }, [packs, packValue]);

  /**
   * Puts the current choice into the real cart.
   *
   * The owner chose "add to the existing cart" rather than replacing it, so
   * anything already there is left alone — and the bill below therefore shows
   * the WHOLE cart total, not this line's. Showing only this line's price while
   * charging for the rest would be the worst possible bug on an order form.
   */
  async function syncToCart() {
    if (!product || !selected || syncing.current) return;
    syncing.current = true;
    try {
      if (lineIdRef.current) {
        await updateItem.mutateAsync({ itemId: lineIdRef.current, quantity: qty });
      } else {
        const res = await addToCart.mutateAsync({
          productId: product.id,
          variantId: selected.value ? Number(selected.value) : undefined,
          quantity: qty,
        });
        const items = (res as { items?: { id: number; variantId?: number }[] })?.items ?? [];
        lineIdRef.current = items[items.length - 1]?.id ?? null;
      }
    } finally {
      syncing.current = false;
    }
  }

  if (!slug) {
    return (
      <div className="rounded-brand border border-dashed border-line bg-beige p-6 text-center font-body text-sm text-muted">
        Choose a product for this order card
      </div>
    );
  }
  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-brand bg-beige" />;
  }
  if (!product) {
    return (
      <div className="rounded-brand border border-dashed border-line bg-beige p-6 text-center font-body text-sm text-muted">
        Product “{slug}” not found
      </div>
    );
  }

  const errs = formState.errors?.shippingAddress;

  return (
    <div className="mx-auto w-full max-w-[560px]">
      {typeof heading === "string" && heading && (
        <h2 className="mb-1 font-serif text-[26px] font-bold text-white">{heading}</h2>
      )}
      {typeof subheading === "string" && subheading && (
        <p className="mb-4 font-body text-sm text-white/75">{subheading}</p>
      )}

      <div
        // text-ink is explicit, not decorative. The card is usually dropped
        // into a dark hero section whose CSS sets `color: var(--paper)`, and
        // inheriting that put cream text on a cream card -- invisible. A block
        // cannot rely on the colour of whatever page it is embedded in.
        className="rounded-[20px] bg-cream p-5 text-ink shadow-[0_24px_60px_rgba(15,46,27,.22)]"
      >
        {/* What you are buying. Hidden by default only if the author asks --
            a landing page that already shows a big hero shot does not need
            the product twice. */}
        {showImage !== "no" && image && (
          <div className="mb-4 flex items-center gap-3.5">
            {/* Plain <img>: next/image needs a loader config this block cannot
                see, and the URL is already a resized derivative. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt={product.name}
              width={96}
              height={96}
              loading="lazy"
              decoding="async"
              className="h-24 w-24 shrink-0 rounded-[14px] border border-line bg-white object-contain"
            />
            <div className="min-w-0">
              <p className="line-clamp-2 font-ui text-sm font-bold text-ink">
                {product.name}
              </p>
              {selected && (
                <p className="mt-0.5 font-ui text-lg font-bold text-green">
                  {formatMoney(selected.price)}
                  {selected.originalPrice && (
                    <span className="ml-2 font-body text-xs font-normal text-muted line-through">
                      {formatMoney(selected.originalPrice)}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Pack picker */}
        {packs.length > 1 && (
          <div className="mb-4 grid grid-cols-2 gap-2.5">
            {packs.map((p) => {
              const on = p.value === (packValue ?? packs[0].value);
              return (
                <button
                  key={p.value}
                  type="button"
                  disabled={p.outOfStock}
                  onClick={() => {
                    interacted.current = true;
                    setPackValue(p.value);
                    // A different pack is a different cart line, so the old one
                    // is forgotten and re-added on the next sync.
                    lineIdRef.current = null;
                  }}
                  className={`rounded-[14px] border-[1.5px] p-3 text-left transition disabled:opacity-40 ${
                    on ? "border-green bg-green/[0.06]" : "border-line bg-white"
                  }`}
                >
                  <span className="block font-ui text-[11px] uppercase tracking-wide text-muted">
                    {p.label}
                  </span>
                  <span className="mt-0.5 block font-ui text-xl font-bold text-green">
                    {formatMoney(p.price)}
                  </span>
                  {p.originalPrice && (
                    <span className="font-body text-xs text-muted line-through">
                      {formatMoney(p.originalPrice)}
                    </span>
                  )}
                  {/* A greyed-out button with no reason reads as broken. */}
                  {p.outOfStock && (
                    <span className="mt-1 block font-body text-[11px] font-semibold text-red-600">
                      স্টকে নেই
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Quantity */}
        <div className="mb-4 flex items-center justify-between rounded-[14px] border-[1.5px] border-line px-3 py-2">
          <span className="font-ui text-sm font-bold text-ink">পরিমাণ</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="কমান"
              disabled={qty <= 1}
              onClick={() => {
                interacted.current = true;
                setQty((q) => Math.max(1, q - 1));
              }}
              className="h-10 w-10 rounded-[11px] border-[1.5px] border-line text-xl font-bold text-green disabled:opacity-35"
            >
              −
            </button>
            <span className="min-w-[44px] text-center font-ui text-lg font-bold">{qty}</span>
            <button
              type="button"
              aria-label="বাড়ান"
              onClick={() => {
                interacted.current = true;
                setQty((q) => q + 1);
              }}
              className="h-10 w-10 rounded-[11px] border-[1.5px] border-line text-xl font-bold text-green"
            >
              +
            </button>
          </div>
        </div>

        {/* Bill — the WHOLE cart, because this adds to it rather than replacing */}
        <div className="mb-4 rounded-[14px] border border-line bg-white p-3.5">
          <div className="flex justify-between py-1 font-body text-sm text-muted">
            <span>পণ্য</span>
            <span className="text-ink">
              {selected?.label} × {qty}
            </span>
          </div>
          {cart && (
            <>
              <div className="flex justify-between py-1 font-body text-sm text-muted">
                <span>সাব-টোটাল</span>
                <span className="text-ink">{formatMoney(cart.subTotal)}</span>
              </div>
              <div className="flex justify-between py-1 font-body text-sm text-muted">
                <span>ডেলিভারি</span>
                <span className="text-ink">
                  {Number(cart.shippingFee) > 0
                    ? formatMoney(cart.shippingFee)
                    : "কুরিয়ার চার্জ প্রযোজ্য"}
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between border-t border-dashed border-line pt-2.5">
                <b className="font-ui text-sm text-ink">সর্বমোট</b>
                <strong className="font-ui text-2xl font-bold text-green">
                  {formatMoney(cart.grandTotal)}
                </strong>
              </div>
            </>
          )}
          {!cart?.items.length && (
            <p className="mt-2 font-body text-xs text-muted">
              পরিমাণ বাছাই করে নিচের বোতামে চাপ দিন — তখন মোট হিসাব দেখা যাবে।
            </p>
          )}
        </div>

        {/* The REAL checkout fields. `register` comes from the provider's own
            form, so these are the same inputs, names and validation as
            /checkout -- not a copy. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block font-ui text-sm font-bold text-ink">
              আপনার নাম <span className="text-red-600">*</span>
            </span>
            <input
              placeholder="পূর্ণ নাম"
              className="h-12 w-full rounded-[12px] border-[1.5px] border-line bg-white px-3.5 font-body text-base text-ink outline-none placeholder:text-muted focus:border-green"
              {...register("shippingAddress.recipientName")}
            />
            {errs?.recipientName && (
              <p className="mt-1 font-body text-xs text-red-600">
                {errs.recipientName.message}
              </p>
            )}
          </label>
          <label className="block">
            <span className="mb-1.5 block font-ui text-sm font-bold text-ink">
              ফোন নম্বর <span className="text-red-600">*</span>
            </span>
            <input
              placeholder="01XXXXXXXXX"
              inputMode="numeric"
              className="h-12 w-full rounded-[12px] border-[1.5px] border-line bg-white px-3.5 font-body text-base text-ink outline-none placeholder:text-muted focus:border-green"
              {...register("shippingAddress.phone")}
            />
            {errs?.phone && (
              <p className="mt-1 font-body text-xs text-red-600">{errs.phone.message}</p>
            )}
          </label>
        </div>

        <label className="mt-3 block">
          <span className="mb-1.5 block font-ui text-sm font-bold text-ink">
            সম্পূর্ণ ঠিকানা <span className="text-red-600">*</span>
          </span>
          <textarea
            rows={3}
            placeholder="বাড়ি, রাস্তা, এলাকা, থানা, জেলা"
            className="w-full rounded-[12px] border-[1.5px] border-line bg-white px-3.5 py-2.5 font-body text-base text-ink outline-none placeholder:text-muted focus:border-green"
            {...register("shippingAddress.addressLine")}
          />
          {errs?.addressLine && (
            <p className="mt-1 font-body text-xs text-red-600">{errs.addressLine.message}</p>
          )}
        </label>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <span className="mb-1.5 block font-ui text-sm font-bold text-ink">
              জেলা <span className="text-red-600">*</span>
            </span>
            <Controller
              name="shippingAddress.district"
              control={control}
              render={({ field }) => (
                <Select
                  options={DISTRICT_OPTIONS}
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder="জেলা বাছাই করুন"
                />
              )}
            />
            {errs?.district && (
              <p className="mt-1 font-body text-xs text-red-600">{errs.district.message}</p>
            )}
          </div>
          <div>
            <span className="mb-1.5 block font-ui text-sm font-bold text-ink">
              থানা / এলাকা <span className="text-red-600">*</span>
            </span>
            {thanas ? (
              <Controller
                name="shippingAddress.area"
                control={control}
                render={({ field }) => (
                  <Select
                    options={thanas.map((t) => ({ value: t, label: t }))}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="থানা বাছাই করুন"
                  />
                )}
              />
            ) : (
              <input
                placeholder="থানা / এলাকা"
                className="h-12 w-full rounded-[12px] border-[1.5px] border-line bg-white px-3.5 font-body text-base text-ink outline-none placeholder:text-muted focus:border-green"
                {...register("shippingAddress.area")}
              />
            )}
            {errs?.area && (
              <p className="mt-1 font-body text-xs text-red-600">{errs.area.message}</p>
            )}
          </div>
        </div>

        <label className="mt-3 block">
          <span className="mb-1.5 block font-ui text-sm font-bold text-ink">
            নোট (ঐচ্ছিক)
          </span>
          <input
            placeholder="বিশেষ নির্দেশনা থাকলে লিখুন"
            className="h-12 w-full rounded-[12px] border-[1.5px] border-line bg-white px-3.5 font-body text-base text-ink outline-none placeholder:text-muted focus:border-green"
            {...register("customerNote")}
          />
        </label>

        <div className="mt-4">{renderTermsAgreement("")}</div>

        {placeOrderErrorMessage && (
          <p className="mb-2 font-body text-sm text-red-600">{placeOrderErrorMessage}</p>
        )}

        {/* Submits EXPLICITLY rather than relying on type="submit".
            
            This card is often portalled into a pasted HTML page, and a React
            portal preserves context but NOT DOM nesting -- the button ends up
            outside the provider's <form> element, so an implicit submit does
            absolutely nothing and the click looks ignored. Calling the
            provider's own `submitForm` works wherever the card is mounted, and
            it is the same handler /checkout uses, so validation, fraud
            preflight, COD OTP and the order mutation are all unchanged.

            The cart sync runs first and is awaited, because the order is built
            from the cart and must contain this pack before submission. */}
        <Button
          type="button"
          variant="green"
          block
          disabled={
            placeOrder.isPending ||
            addToCart.isPending ||
            updateItem.isPending ||
            pendingSubmit
          }
          onClick={async () => {
            await syncToCart();
            setPendingSubmit(true);
          }}
        >
          {(typeof ctaLabel === "string" && ctaLabel.trim()) ||
            placeOrderLabel ||
            "অর্ডার কনফার্ম করুন"}
        </Button>

        {typeof whatsappNumber === "string" && whatsappNumber.trim() && (
          <>
            <div className="my-3 flex items-center gap-3 font-body text-xs text-muted">
              <span className="h-px flex-1 bg-line" />
              অথবা
              <span className="h-px flex-1 bg-line" />
            </div>
            <a
              href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] bg-[#25D366] font-ui text-base font-bold text-white"
            >
              WhatsApp-এ অর্ডার করুন
            </a>
          </>
        )}
      </div>
    </div>
  );
}
