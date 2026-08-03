"use client";

import { useLocale } from "next-intl";
import { useCartDrawerStore, useMobileNavDrawerStore } from "@amader/ui";
import { Link } from "@/i18n/navigation";
import { toApiLocale } from "@/lib/api-locale";
import { useCartQuery } from "@/hooks/useCart";
import { useMe } from "@/hooks/useAuth";

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
const searchIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
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
// bottom bar, 5 equal-width icon+label items (Home/Menu/Cart/Search/Account),
// white 16px icons + 10px uppercase labels, cart item-count badge, brand
// color instead of the reference's orange per explicit request. Mobile only
// (md:hidden) — desktop keeps the existing header/nav entirely.
export function MobileStickyFooter() {
  const locale = useLocale();
  const { data: cart } = useCartQuery(toApiLocale(locale));
  const cartCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const { data: me } = useMe();
  const openMobileNav = useMobileNavDrawerStore((s) => s.open);
  const openCartDrawer = useCartDrawerStore((s) => s.open);

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1000] flex items-center bg-[#1F703C] px-2.5 pb-2.5 pt-2.5 md:hidden">
      <FooterItem icon={homeIcon} label="Home" href="/" />
      <FooterItem icon={menuIcon} label="Menu" onClick={openMobileNav} />
      <FooterItem icon={cartIcon} label="Cart" badge={cartCount} onClick={openCartDrawer} />
      <FooterItem icon={searchIcon} label="Search" href="/search" />
      <FooterItem icon={accountIcon} label="Account" href={me ? "/account" : "/login"} />
    </div>
  );
}
