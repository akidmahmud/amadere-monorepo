"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@amader/ui";
import { useRouter } from "@/i18n/navigation";
import { useAddToCart } from "@/hooks/useCart";
import { toApiLocale } from "@/lib/api-locale";
import { toDisplayImageUrl } from "@/lib/media";
import type { components } from "@/lib/api/schema";

type PublicProductDetailDto = components["schemas"]["PublicProductDetailDto"];

const bookIcon = (
  <svg
    viewBox="0 0 24 24"
    width={14}
    height={14}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="shrink-0"
  >
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 15.5z" />
    <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h4.5a1.5 1.5 0 0 0 1.5-1.5z" />
  </svg>
);

const closeIcon = (
  <svg
    viewBox="0 0 24 24"
    width={18}
    height={18}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
  >
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

// The price the buyer actually pays — same expression PdpPurchasePanel uses
// for a no-variant product (a digital product never has variants: the admin's
// digital form drops the Variants tab entirely). A "0" here is a real free
// product, not a missing price, and the CTA says so instead of showing "৳0".
function effectivePrice(product: PublicProductDetailDto): string {
  return product.salePrice ?? product.price ?? "0";
}

/**
 * The "আরও পড়ুন" (read more) call-out overlaid on a DIGITAL product's image,
 * and the preview modal it opens.
 *
 * The modal shows only the page RANGE the admin chose to publish
 * (Product.digitalPreviewStartPage..digitalPreviewEndPage, rendered to public
 * R2 images at upload time — see ProductPreviewPage). That range is an
 * excerpt, not the front of the book, so every page label here is the page's
 * REAL number in the document. Scrolling past the last one lands on the buy
 * prompt: the free sample ends and the paywall starts, which is the point of
 * the whole section.
 *
 * The CTA is deliberately the same path as the PDP's own "Buy Now" —
 * useAddToCart (also the sitewide add_to_cart analytics choke point) then a
 * push to /checkout — rather than a second purchase route that could drift
 * from it.
 */
export function DigitalPreviewButton({
  product,
}: {
  product: PublicProductDetailDto;
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("digitalPreview");

  // Nothing to preview, nothing to offer. The PDP renders this only for a
  // DIGITAL product, but a digital product whose PDF has not been uploaded
  // yet has no preview rows at all.
  if (product.previewPages.length === 0) return null;

  return (
    <>
      {/* Top-right corner of the main image, per explicit request. That corner
          is empty on this PDP — the gallery's own prev/next arrows are
          vertically centred, the thumbnails are a left-hand column, and the
          wishlist heart lives in the purchase panel beside the qty stepper,
          not on the image — so this badge stacks on nothing.

          pointer-events-none on the positioning layer so the overlay cannot
          swallow clicks meant for the gallery underneath; only the badge
          itself is clickable. */}
      <div className="pointer-events-none absolute right-2 top-2 z-10 flex justify-end sm:right-3 sm:top-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          // Sized against the BENGALI label ("আরও পড়ুন"), which is wider than
          // the English one: 11px type and tight padding keep it around 90px
          // — roughly 30% of the ~300px-wide image at a 390px viewport, so it
          // reads as a corner badge instead of covering the cover art.
          // Deliberately NO max-width: this button's containing block is the
          // shrink-to-fit overlay layer above, not the image, so a percentage
          // cap here resolves against the badge's own width and clips the
          // Bengali label. whitespace-nowrap keeps it on one line instead.
          // bg-green/95 leaves a hint of the artwork visible behind it.
          className="pointer-events-auto flex items-center gap-1.5 whitespace-nowrap rounded-full bg-green/95 px-2.5 py-1.5 font-ui text-[11px] font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.28)] transition-colors hover:bg-green-dark sm:gap-2 sm:px-3 sm:text-xs"
        >
          {bookIcon}
          {t("readMore")}
        </button>
      </div>
      {open && (
        <DigitalPreviewModal product={product} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function DigitalPreviewModal({
  product,
  onClose,
}: {
  product: PublicProductDetailDto;
  onClose: () => void;
}) {
  const t = useTranslations("digitalPreview");
  const locale = toApiLocale(useLocale());
  const addToCart = useAddToCart(locale);
  const router = useRouter();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const pages = product.previewPages;
  const totalPages = product.digitalPageCount;
  const price = effectivePrice(product);
  const isFree = Number(price) <= 0;

  // The admin-chosen excerpt, e.g. pages 5-9 of 48. Falls back to the rows'
  // own page numbers so the modal still reads correctly for a product whose
  // range predates the stored columns (or was cleared) while its rendered
  // pages remain.
  const startPage =
    product.digitalPreviewStartPage ?? pages[0]?.pageNumber ?? null;
  const endPage =
    product.digitalPreviewEndPage ??
    pages[pages.length - 1]?.pageNumber ??
    null;
  const hasRange = startPage !== null && endPage !== null;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Same reason as PackPickerModal: move real browser focus into the dialog
  // the instant it opens, so Escape works and assistive tech lands inside it.
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // The page behind must not scroll while a full-height reader sits on top of
  // it — on a phone that scrolls the PDP away underneath and leaves the
  // shopper somewhere else entirely once the modal closes.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Mirrors PdpPurchasePanel's handleBuyNow exactly (add the line, then go to
  // checkout). The backend's /cart/buy-now is a pricing quote only and never
  // touches the persisted cart, so this is the real purchase path.
  function handleBuy() {
    addToCart.mutate(
      { productId: product.id, quantity: product.minOrderQuantity || 1 },
      { onSuccess: () => router.push("/checkout") },
    );
  }

  return (
    <div
      // z-[1010] is this app's established full-screen-overlay layer (see
      // CartDrawer/FilterDrawer/MobileDrawer, all at 1010/1020): the mobile
      // MobileStickyFooter nav is z-[1000] and covered the bottom of this
      // reader — including the buy prompt — at anything lower.
      className="fixed inset-0 z-[1010] flex items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Full-bleed sheet on a phone (dvh, not vh, so a collapsing mobile
          address bar cannot cut the buy prompt off), a centred card from sm
          up. */}
      <div className="flex h-[100dvh] w-full flex-col bg-white sm:h-auto sm:max-h-[92vh] sm:max-w-[720px] sm:rounded-xl sm:shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="truncate font-ui text-sm font-semibold text-ink sm:text-base">
              {product.name}
            </h2>
            <p className="mt-0.5 font-body text-xs text-muted">
              {hasRange && totalPages
                ? t("rangeOfTotal", {
                    start: startPage,
                    end: endPage,
                    total: totalPages,
                  })
                : hasRange
                  ? t("range", { start: startPage, end: endPage })
                  : totalPages
                    ? t("previewOf", { shown: pages.length, total: totalPages })
                    : t("previewShown", { shown: pages.length })}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label={t("close")}
            onClick={onClose}
            className="shrink-0 rounded-full p-1.5 text-muted hover:bg-beige hover:text-ink"
          >
            {closeIcon}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-beige/40 px-3 py-3 sm:px-5 sm:py-4">
          <div className="mx-auto flex max-w-[560px] flex-col gap-4">
            {pages.map((page) => {
              const url = toDisplayImageUrl(page.imageUrl);
              if (!url) return null;
              const label = t("pageOf", {
                page: page.pageNumber,
                total: totalPages ?? pages.length,
              });
              return (
                <figure
                  key={page.pageNumber}
                  className="overflow-hidden rounded-lg bg-white shadow-[0_1px_4px_rgba(0,0,0,0.12)]"
                >
                  {/* A plain <img>, like DownloadsList's covers: next/image is
                      `unoptimized` app-wide (next.config.ts) so it would add
                      nothing here, and a rendered PDF page has no known
                      intrinsic aspect ratio to reserve space for. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={label}
                    // The first page OF THE PREVIEW, which is page 5 for a
                    // 5-9 range — not page number 1, which such a range never
                    // contains.
                    loading={
                      page.pageNumber === pages[0]?.pageNumber
                        ? "eager"
                        : "lazy"
                    }
                    className="block h-auto w-full"
                  />
                  <figcaption className="border-t border-line px-3 py-1.5 text-center font-body text-[11px] text-muted">
                    {label}
                  </figcaption>
                </figure>
              );
            })}

            {/* The paywall. At the END of the scroll on purpose — the shopper
                reads the free sample first and meets the offer when it runs
                out, rather than being asked to buy before reading anything. */}
            <div className="rounded-lg border border-green/30 bg-white p-5 text-center">
              <h3 className="font-ui text-base font-semibold text-ink">
                {t("endTitle")}
              </h3>
              <p className="mx-auto mt-1.5 max-w-[380px] font-body text-sm text-muted">
                {hasRange && totalPages
                  ? t("endBodyRange", {
                      start: startPage,
                      end: endPage,
                      total: totalPages,
                    })
                  : totalPages
                    ? t("endBody", { shown: pages.length, total: totalPages })
                    : t("endBodyNoTotal")}
              </p>
              {addToCart.isError && (
                <p className="mt-3 font-ui text-sm text-red-600">
                  {t("addFailed")}
                </p>
              )}
              <button
                type="button"
                disabled={addToCart.isPending}
                onClick={handleBuy}
                className="mt-4 flex h-12 w-full items-center justify-center rounded-md bg-green font-ui text-sm font-semibold uppercase text-white transition-colors hover:bg-green-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {addToCart.isPending
                  ? t("adding")
                  : isFree
                    ? t("buyFree")
                    : t("buy", { price: formatMoney(price) })}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
