"use client";

import { useLocale } from "next-intl";
import { useCartDrawerStore, useMobileNavDrawerStore } from "@amader/ui";
import { Link, usePathname } from "@/i18n/navigation";
import { toApiLocale } from "@/lib/api-locale";
import { useCartQuery } from "@/hooks/useCart";
import { useMe } from "@/hooks/useAuth";
import { useProductFloatingBarStore } from "./ProductFloatingBarContext";

function useIsCheckoutPage(): boolean {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "checkout";
}

const homeIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
  </svg>
);
const menuIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);
const cartIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="21" r="1.4" fill="currentColor" stroke="none" />
    <path d="M2.5 3h2l2.6 12.4a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6L21 8H6" />
  </svg>
);
const blogIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
    <path d="M7.5 8.5h9M7.5 12h9M7.5 15.5h5.5" />
  </svg>
);
const accountIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
  </svg>
);

function FooterItem({
  icon,
  label,
  href,
  onClick,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  badge?: number;
}) {
  const content = (
    <>
      <span className="relative">
        {icon}
        {badge !== undefined && (
          <span className="absolute -right-2 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-[#222831] text-[11px] leading-none text-white">
            {badge}
          </span>
        )}
      </span>
      <p className="mt-2 font-ui text-[10px] uppercase tracking-wide text-white">{label}</p>
    </>
  );
  const className = "flex flex-1 flex-col items-center text-white";
  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

// Reference: https://ghorerbazar.com/ mobile `.sticky-footer.style-1` — fixed
// bottom bar, 5 equal-width icon+label items (Home/Menu/Cart/Blog/Account —
// Blog replaces the reference's Search per explicit request), white 16px
// icons + 10px uppercase labels, cart item-count badge, brand color instead
// of the reference's orange per explicit request. Mobile only
// (md:hidden) — desktop keeps the existing header/nav entirely.
//
// On product pages, once the user scrolls past the main Add to Cart / Buy Now
// buttons (#pdp-buy-buttons), this bar transforms in-place into a product
// action bar showing Chat + Add to Cart (outline) + Buy Now (solid) pills, matching the desktop sticky bar.
export function MobileStickyFooter() {
  const locale = useLocale();
  const isCheckoutPage = useIsCheckoutPage();
  const { data: cart } = useCartQuery(toApiLocale(locale));
  const cartCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const { data: me } = useMe();
  const openMobileNav = useMobileNavDrawerStore((s) => s.open);
  const openCartDrawer = useCartDrawerStore((s) => s.open);

  // Product page store — all defaults when not on a product page.
  const onAddToCart = useProductFloatingBarStore((s) => s.onAddToCart);
  const onBuyNow = useProductFloatingBarStore((s) => s.onBuyNow);
  const isDigital = useProductFloatingBarStore((s) => s.isDigital);
  const isPending = useProductFloatingBarStore((s) => s.isPending);
  const outOfStock = useProductFloatingBarStore((s) => s.outOfStock);
  // Product pages show the Chat / Add to Cart / Buy Now bar straight away
  // (not only after scrolling past the page's own buttons), in place of the
  // Home/Menu/... bar.
  const showProductBar = !outOfStock && onAddToCart !== null;

  // Nothing at all on checkout. `isCheckoutPage` was already being computed
  // here but never actually used, so the bar kept covering the bottom of the
  // page — including, at times, the place-order button. Every destination in
  // it (Home, Menu, Cart, Blog, Account) leads away from a purchase in
  // progress, which is exactly what a checkout page should not offer.
  //
  // Returned after the hooks above, never before, so the hook order stays
  // identical on every render.
  if (isCheckoutPage) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1000] md:hidden">
      {/* Container with a fixed height so transitions don't jump */}
      <div className="relative h-[62px] overflow-hidden">
        {/* --- Default navigation bar --- */}
        <div
          className={`absolute inset-0 flex items-center bg-[#1F703C] px-2.5 transition-all duration-300 ease-in-out ${
            showProductBar
              ? "-translate-y-full opacity-0 pointer-events-none"
              : "translate-y-0 opacity-100"
          }`}
        >
          <FooterItem icon={homeIcon} label="Home" href="/" />
          <FooterItem icon={menuIcon} label="Menu" onClick={openMobileNav} />
          <FooterItem icon={cartIcon} label="Cart" badge={cartCount} onClick={openCartDrawer} />
          <FooterItem icon={blogIcon} label="Blog" href="/blog" />
          <FooterItem icon={accountIcon} label="Account" href={me ? "/account" : "/login"} />
        </div>

        {/* --- Product action bar (Chat + Add Cart + Buy Now) --- */}
        <div
          className={`absolute inset-0 flex items-center justify-between gap-2.5 bg-white px-3.5 border-t border-slate-100 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] transition-all duration-300 ease-in-out ${
            showProductBar
              ? "translate-y-0 opacity-100"
              : "translate-y-full opacity-0 pointer-events-none"
          }`}
        >
          {/* Home: a way back to browsing without losing the buy buttons. */}
          <Link
            href="/"
            aria-label="Home"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-green text-green transition-opacity hover:opacity-85 active:scale-95 [&_svg]:h-5 [&_svg]:w-5"
          >
            {homeIcon}
          </Link>

          {/* Add Cart + Buy Now buttons fill the remaining space — or one
              Download button, matching what the page itself offers for a
              digital product. A bar advertising "Add Cart" over a page whose
              only action is "Download" is the bar being wrong. */}
          <div className="flex flex-1 items-center gap-2.5">
            {isDigital ? (
              <button
                type="button"
                disabled={isPending}
                onClick={onBuyNow ?? undefined}
                className="h-11 flex-1 rounded-full bg-green font-ui text-sm font-semibold text-white transition-colors hover:bg-green-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Preparing…" : "Download"}
              </button>
            ) : (
              <>
            <button
              type="button"
              disabled={isPending}
              onClick={onAddToCart ?? undefined}
              className="h-11 flex-1 rounded-full border border-green font-ui text-sm font-semibold text-green transition-colors hover:bg-green hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Adding…" : "Add to Cart"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={onBuyNow ?? undefined}
              className="checkout-shake h-11 flex-1 rounded-full bg-green font-ui text-sm font-semibold text-white transition-colors hover:bg-green-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Adding…" : "Buy Now"}
            </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
