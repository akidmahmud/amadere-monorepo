/**
 * @deprecated This component is no longer used. Its functionality has been
 * absorbed into MobileStickyFooter via ProductFloatingBarContext /
 * ProductFloatingBarProvider. The MobileStickyFooter now transforms in-place
 * into a Buy Now / Add to Cart bar when the user scrolls past #pdp-buy-buttons
 * on a product page.
 *
 * Kept for reference only — can be safely deleted.
 */
"use client";

import { IMG, toDisplayImageUrl } from "@/lib/media";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { formatMoney } from "@amader/ui";
import { buildPackSizeOptions, defaultVariantId } from "@/lib/pdp";
import { toApiLocale } from "@/lib/api-locale";
import { useAddToCart, useCartQuery } from "@/hooks/useCart";
import { buildWhatsappLink, fillTemplate } from "@/lib/whatsapp";
import type { WhatsappConfig } from "@/lib/whatsapp";
import type { components } from "@/lib/api/schema";

type PublicProductDetailDto = components["schemas"]["PublicProductDetailDto"];

// A product/variant's own `stock` count has no dedicated "low stock" enum
// value (schema.prisma's StockStatus is only IN_STOCK/OUT_OF_STOCK/
// ON_BACKORDER) — reusing the same 10-unit threshold Net Profit's dashboard
// already uses internally (net_profit.overview.lowStockThreshold) for a
// consistent definition of "low" rather than inventing a separate one here.
const LOW_STOCK_THRESHOLD = 10;

const cartIcon = (
  <svg
    viewBox="0 0 24 24"
    width={22}
    height={22}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="9" cy="21" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="21" r="1.4" fill="currentColor" stroke="none" />
    <path d="M2.5 3h2l2.6 12.4a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6L21 8H6" />
  </svg>
);
const whatsappIcon = (
  <svg viewBox="0 0 24 24" fill="currentColor" width={22} height={22}>
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.92 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.67c2.19 0 4.25.85 5.79 2.4a8.2 8.2 0 0 1 2.42 5.84c0 4.55-3.71 8.25-8.26 8.25a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.39c0-4.55 3.71-8.24 8.29-8.24Zm-4.5 4.66c-.16 0-.42.06-.64.31-.22.25-.85.83-.85 2.03s.87 2.36.99 2.52c.12.16 1.7 2.71 4.24 3.7 2.1.82 2.53.66 2.99.62.46-.04 1.48-.6 1.69-1.19.21-.58.21-1.08.14-1.19-.06-.1-.22-.16-.46-.28-.24-.12-1.48-.73-1.71-.82-.23-.08-.4-.12-.56.13-.16.24-.64.81-.79.98-.15.16-.29.19-.53.06-.24-.12-1.03-.38-1.97-1.21-.73-.65-1.22-1.45-1.36-1.69-.14-.24-.02-.37.11-.49.11-.11.24-.29.36-.43.12-.14.16-.24.24-.4.08-.16.04-.31-.02-.43-.06-.12-.55-1.37-.77-1.87-.2-.48-.4-.42-.56-.42h-.44Z" />
  </svg>
);
const checkIcon = (
  <svg
    viewBox="0 0 24 24"
    width={22}
    height={22}
    fill="none"
    stroke="currentColor"
    strokeWidth={2.4}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const closeIcon = (
  <svg
    viewBox="0 0 24 24"
    width={18}
    height={18}
    fill="none"
    stroke="currentColor"
    strokeWidth={2.4}
    strokeLinecap="round"
  >
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const chevronIcon = (
  <svg
    viewBox="0 0 24 24"
    width={12}
    height={12}
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

// Mobile-only floating "island" — per explicit request (matching a supplied
// design spec), a solid-green pill that appears once the shopper scrolls
// past PdpPurchasePanel's Add to Cart/Buy Now row (that row carries
// id="pdp-buy-buttons" specifically for the IntersectionObserver below to
// watch) and disappears again if they scroll back up to it. Own independent
// pack-size selection (defaults to the product's default variant) rather
// than sharing state with the main panel above — this is a fast standalone
// "quick add", not meant to mirror whatever the shopper may have already
// changed higher up the page.
export function ProductMobileIsland({
  product,
  imageUrl,
  whatsappConfig,
}: {
  product: PublicProductDetailDto;
  imageUrl?: string;
  whatsappConfig: WhatsappConfig | null;
}) {
  const [visible, setVisible] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState(() =>
    defaultVariantId(product),
  );
  const [justAdded, setJustAdded] = useState<number | null>(null); // holds the cart's new total item count while the confirmation shows
  const locale = toApiLocale(useLocale());
  const addToCart = useAddToCart(locale);
  const { data: cart } = useCartQuery(locale);
  const packOptions = useMemo(() => buildPackSizeOptions(product), [product]);
  const cartItemCount =
    cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  useEffect(() => {
    const target = document.getElementById("pdp-buy-buttons");
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // `isIntersecting` alone is also false before the row has ever been
        // reached (e.g. right after page load, above the fold) — gating on
        // `boundingClientRect.top < 0` too means this only flips on once the
        // row has genuinely scrolled up past the top edge, not just because
        // it hasn't been scrolled to yet.
        setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  // Confirmation state auto-reverts to the default card after a moment —
  // also dismissible early via its own close button (see justAdded(null) below).
  useEffect(() => {
    if (justAdded === null) return;
    const timer = setTimeout(() => setJustAdded(null), 2500);
    return () => clearTimeout(timer);
  }, [justAdded]);

  if (!visible) return null;

  const selectedVariant = product.hasVariants
    ? product.variants.find((v) => String(v.id) === selectedVariantId)
    : undefined;
  const price = product.hasVariants
    ? (packOptions.find((p) => p.value === selectedVariantId)?.price ?? "0")
    : (product.salePrice ?? product.price ?? "0");
  const stockCount = selectedVariant ? selectedVariant.stock : product.stock;
  // Same rule PdpPurchasePanel's own outOfStock uses: stock only blocks a
  // purchase when trackInventory is on AND allowBackorder is off.
  const outOfStock =
    product.trackInventory && !product.allowBackorder && stockCount < 1;
  const lowStock =
    !outOfStock &&
    product.trackInventory &&
    stockCount > 0 &&
    stockCount <= LOW_STOCK_THRESHOLD;
  // Out-of-stock swaps the quick-add button for a WhatsApp inquiry link —
  // per explicit request, a disabled bag icon that does nothing isn't
  // useful, whereas letting the shopper ask about restock/alternatives is.
  // Same link-building the PDP's own WhatsappOrderButton uses.
  const whatsappHref =
    whatsappConfig?.enabled && whatsappConfig.phoneNumber
      ? buildWhatsappLink(
          whatsappConfig.phoneNumber,
          fillTemplate(whatsappConfig.productMessageTemplate, {
            productName: product.name,
          }),
        )
      : undefined;

  function handleQuickAdd() {
    addToCart.mutate(
      {
        productId: product.id,
        variantId: product.hasVariants ? Number(selectedVariantId) : undefined,
        quantity: product.minOrderQuantity || 1,
      },
      {
        onSuccess: (data) => {
          const newCount =
            data?.items.reduce((sum, item) => sum + item.quantity, 0) ??
            cartItemCount;
          setJustAdded(newCount);
        },
      },
    );
  }

  return (
    // Per the design spec: 16px side margins (mx-4) and 16px above
    // MobileStickyFooter (measured live: 59px tall, so bottom-[75px]).
    <div className="fixed inset-x-4 bottom-[75px] z-[900] md:hidden">
      <div className="relative flex h-16 items-center gap-3 rounded-[20px] bg-[#1F7A4E] px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        {/* Decorative drag-handle bar, purely visual per the spec. */}
        <div className="absolute left-1/2 top-1.5 h-1 w-8 -translate-x-1/2 rounded-full bg-white/50" />

        {justAdded !== null ? (
          <>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#1F7A4E]">
              {checkIcon}
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <p className="truncate font-ui text-sm font-bold text-white">
                কার্টে যোগ করা হয়েছে
              </p>
              <p className="truncate font-ui text-xs text-white/80">
                মোট {justAdded} টি আইটেম
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setJustAdded(null)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/80 hover:text-white"
            >
              {closeIcon}
            </button>
          </>
        ) : (
          <>
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={toDisplayImageUrl(imageUrl, IMG.thumb)}
                alt=""
                className="h-11 w-11 shrink-0 rounded-xl object-cover"
              />
            )}
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-ui text-sm font-bold text-white">
                  {product.name}
                </span>
                {!outOfStock && (
                  <span className="shrink-0 font-ui text-sm font-bold text-white">
                    {formatMoney(price)}
                  </span>
                )}
              </div>
              {outOfStock ? (
                <span className="inline-block rounded-full bg-white px-2 py-0.5 font-ui text-[10px] font-bold text-[#1F7A4E]">
                  স্টক নেই
                </span>
              ) : product.hasVariants &&
                packOptions.length > 0 &&
                selectedVariantId ? (
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Select pack size"
                    value={selectedVariantId}
                    onChange={(e) => setSelectedVariantId(e.target.value)}
                    className="-ml-0.5 max-w-[110px] rounded border-none bg-transparent font-ui text-xs text-white/80 outline-none"
                  >
                    {packOptions.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        className="text-ink"
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-white/70">{chevronIcon}</span>
                  {lowStock && (
                    <span className="font-ui text-[10px] font-bold text-[#FFB300]">
                      কম স্টক!
                    </span>
                  )}
                </div>
              ) : (
                lowStock && (
                  <span className="font-ui text-[10px] font-bold text-[#FFB300]">
                    কম স্টক!
                  </span>
                )
              )}
            </div>
            {outOfStock && whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Ask about this product on WhatsApp"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#25D366]"
              >
                {whatsappIcon}
              </a>
            ) : (
              <button
                type="button"
                aria-label={outOfStock ? "Out of stock" : "Quick add to cart"}
                disabled={addToCart.isPending || outOfStock}
                onClick={handleQuickAdd}
                className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#1F7A4E] disabled:opacity-70"
              >
                {cartIcon}
                {!outOfStock && cartItemCount > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#1F7A4E] px-1 font-ui text-[10px] font-bold text-white ring-2 ring-white">
                    {cartItemCount}
                  </span>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
