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

// Cart icon for the product action bar (with plus badge)
const cartPlusIcon = (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="20" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="17" cy="20" r="1.2" fill="currentColor" stroke="none" />
    <path d="M3 4h2l2.2 10.3a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.2L20 7H6" />
    <path d="M12 8.5v4M10 10.5h4" />
  </svg>
);

const buyNowBoxIcon = (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const chatWhatsappIcon = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 text-white">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.92 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.67c2.19 0 4.25.85 5.79 2.4a8.2 8.2 0 0 1 2.42 5.84c0 4.55-3.71 8.25-8.26 8.25a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.39c0-4.55 3.71-8.24 8.29-8.24Zm-4.5 4.66c-.16 0-.42.06-.64.31-.22.25-.85.83-.85 2.03s.87 2.36.99 2.52c.12.16 1.7 2.71 4.24 3.7 2.1.82 2.53.66 2.99.62.46-.04 1.48-.6 1.69-1.19.21-.58.21-1.08.14-1.19-.06-.1-.22-.16-.46-.28-.24-.12-1.48-.73-1.71-.82-.23-.08-.4-.12-.56.13-.16.24-.64.81-.79.98-.15.16-.29.19-.53.06-.24-.12-1.03-.38-1.97-1.21-.73-.65-1.22-1.45-1.36-1.69-.14-.24-.02-.37.11-.49.11-.11.24-.29.36-.43.12-.14.16-.24.24-.4.08-.16.04-.31-.02-.43-.06-.12-.55-1.37-.77-1.87-.2-.48-.4-.42-.56-.42h-.44Z" />
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
// action bar showing Chat + pill-shaped Add Cart + Buy Now buttons.
export function MobileStickyFooter() {
  const locale = useLocale();
  const isCheckoutPage = useIsCheckoutPage();
  const { data: cart } = useCartQuery(toApiLocale(locale));
  const cartCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const { data: me } = useMe();
  const openMobileNav = useMobileNavDrawerStore((s) => s.open);
  const openCartDrawer = useCartDrawerStore((s) => s.open);

  // Product page store — all defaults when not on a product page.
  const isScrolledPast = useProductFloatingBarStore((s) => s.isScrolledPast);
  const onAddToCart = useProductFloatingBarStore((s) => s.onAddToCart);
  const onBuyNow = useProductFloatingBarStore((s) => s.onBuyNow);
  const isDigital = useProductFloatingBarStore((s) => s.isDigital);
  const isPending = useProductFloatingBarStore((s) => s.isPending);
  const outOfStock = useProductFloatingBarStore((s) => s.outOfStock);
  const whatsappHref = useProductFloatingBarStore((s) => s.whatsappHref);
  const showProductBar = isScrolledPast && !outOfStock && onAddToCart !== null;

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
          {/* Chat icon button */}
          <a
            href={whatsappHref || "https://wa.me/"}
            target="_blank"
            rel="noreferrer noopener"
            className="flex h-full shrink-0 flex-col items-center justify-center pr-1 text-slate-800 transition-opacity hover:opacity-85 active:scale-95"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm">
              {chatWhatsappIcon}
            </span>
            <span className="mt-0.5 font-ui text-[11px] font-bold tracking-tight text-slate-800">Chat</span>
          </a>

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
                className="flex h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full bg-[#10B981] hover:bg-[#0e9f6e] active:bg-[#059669] font-ui text-[13px] font-bold text-white shadow-[0_4px_14px_rgba(16,185,129,0.35)] transition-all active:scale-[0.98] disabled:opacity-60"
              >
                <span>{isPending ? "Preparing…" : "Download"}</span>
              </button>
            ) : (
              <>
            <button
              type="button"
              disabled={isPending}
              onClick={onAddToCart ?? undefined}
              className="flex h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full bg-[#FFB800] hover:bg-[#efa900] active:bg-[#e09e00] font-ui text-[13px] font-bold text-slate-900 shadow-[0_4px_14px_rgba(255,184,0,0.35)] transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {!isPending && cartPlusIcon}
              <span>{isPending ? "Adding…" : "Add Cart"}</span>
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={onBuyNow ?? undefined}
              className="flex h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full bg-[#10B981] hover:bg-[#0e9f6e] active:bg-[#059669] font-ui text-[13px] font-bold text-white shadow-[0_4px_14px_rgba(16,185,129,0.35)] transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {!isPending && buyNowBoxIcon}
              <span>{isPending ? "Adding…" : "Buy Now"}</span>
            </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
