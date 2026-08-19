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

// Cart icon for the product action bar (slightly larger, bold)
const cartActionIcon = (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="21" r="1.4" fill="currentColor" stroke="none" />
    <path d="M2.5 3h2l2.6 12.4a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6L21 8H6" />
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
// action bar showing Home + Buy Now + Add to Cart (per explicit request,
// replacing the old ProductMobileIsland floating pill).
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
  const isPending = useProductFloatingBarStore((s) => s.isPending);
  const outOfStock = useProductFloatingBarStore((s) => s.outOfStock);
  const showProductBar = isScrolledPast && !outOfStock && onAddToCart !== null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1000] md:hidden">
      {/* Container with a fixed height so transitions don't jump */}
      <div className="relative h-[59px] overflow-hidden">
        {/* --- Default navigation bar --- */}
        <div
          className={`absolute inset-0 flex items-center bg-[#1F703C] px-2.5 transition-all duration-300 ease-in-out ${
            showProductBar
              ? "-translate-y-full opacity-0"
              : "translate-y-0 opacity-100"
          }`}
        >
          <FooterItem icon={homeIcon} label="Home" href="/" />
          <FooterItem icon={menuIcon} label="Menu" onClick={openMobileNav} />
          <FooterItem icon={cartIcon} label="Cart" badge={cartCount} onClick={openCartDrawer} />
          <FooterItem icon={blogIcon} label="Blog" href="/blog" />
          <FooterItem icon={accountIcon} label="Account" href={me ? "/account" : "/login"} />
        </div>

        {/* --- Product action bar (Buy Now + Add to Cart) --- */}
        <div
          className={`absolute inset-0 flex items-center bg-[#1F703C] transition-all duration-300 ease-in-out ${
            showProductBar
              ? "translate-y-0 opacity-100"
              : "translate-y-full opacity-0"
          }`}
        >
          {/* Home icon — retained as a quick nav anchor */}
          <Link
            href="/"
            className="flex h-full w-12 shrink-0 flex-col items-center justify-center text-white"
          >
            <span>{homeIcon}</span>
            <p className="mt-1 font-ui text-[10px] uppercase tracking-wide text-white">Home</p>
          </Link>

          {/* Buy Now + Add to Cart buttons fill the remaining space */}
          <div className="flex flex-1 items-center gap-2 px-2">
            <button
              type="button"
              disabled={isPending}
              onClick={onBuyNow ?? undefined}
              className="flex h-[40px] flex-1 animate-[wiggle_2.5s_ease-in-out_infinite] items-center justify-center gap-1.5 rounded-lg bg-[#D3A01F] font-ui text-xs font-bold uppercase tracking-wide text-white transition-colors active:bg-[#b88a1a] disabled:opacity-60"
            >
              {isPending ? "Adding…" : "Buy Now"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={onAddToCart ?? undefined}
              className="flex h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#166534] font-ui text-xs font-bold uppercase tracking-wide text-white transition-colors active:bg-[#14532d] disabled:opacity-60"
            >
              {!isPending && cartActionIcon}
              {isPending ? "Adding…" : "Add to Cart"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
