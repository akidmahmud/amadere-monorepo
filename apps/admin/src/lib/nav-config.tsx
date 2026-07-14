import type { AppNavItem } from "@amader/admin-ui";

const overviewIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const productsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M20.5 7.5 12 3 3.5 7.5 12 12l8.5-4.5Z" />
    <path d="M3.5 7.5v9L12 21l8.5-4.5v-9M12 12v9" />
  </svg>
);

const homepageSectionsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <rect x="3" y="4" width="18" height="6" rx="1.5" />
    <rect x="3" y="14" width="8" height="6" rx="1.5" />
    <rect x="13" y="14" width="8" height="6" rx="1.5" />
  </svg>
);

const brandsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M7 7h11l-2-3M17 17H6l2 3" />
  </svg>
);

const categoriesIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M4 5h16v14H4z" />
    <path d="M8 9h5M8 13h8" />
  </svg>
);

const tagsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.17L4 3v5.59a2 2 0 0 0 .66 1.41l9.59 9.59a2 2 0 0 0 2.83 0l3.51-3.51a2 2 0 0 0 0-2.83z" />
    <circle cx="8" cy="8" r="1.5" />
  </svg>
);

const attributesIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M8 2v4M16 2v4M3 10h18" />
  </svg>
);

const collectionsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M3 7h18M3 12h18M3 17h18" />
  </svg>
);

const bundlesIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M21 8 12 3 3 8l9 5 9-5Z" />
    <path d="M3 8v8l9 5 9-5V8M12 13v8" />
  </svg>
);

const ordersIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
    <path d="M3 6h18M9 10a3 3 0 0 0 6 0" />
  </svg>
);

const shipmentsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <rect x="1" y="6" width="15" height="12" rx="1.5" />
    <path d="M16 10h4l3 3v5h-7z" />
    <circle cx="6" cy="20" r="1.8" />
    <circle cx="18" cy="20" r="1.8" />
  </svg>
);

const discountsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="m20 9-9-6-8 8 9 9 8-8V9Z" />
    <circle cx="15" cy="8" r="1.5" />
    <path d="m6 14 8-8" />
  </svg>
);

const giftVouchersIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <rect x="3" y="8" width="18" height="13" rx="1.5" />
    <path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1s4 1 6 1c2 0 6 2 6-1s-4-3-6 0Z" />
  </svg>
);

const reviewsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01Z" />
  </svg>
);

const blogIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    <path d="M9 7h7M9 11h7" />
  </svg>
);

const blogCategoriesIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M4 5h16v14H4z" />
    <path d="M8 9h5M8 13h8" />
  </svg>
);

const blogTagsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.17L4 3v5.59a2 2 0 0 0 .66 1.41l9.59 9.59a2 2 0 0 0 2.83 0l3.51-3.51a2 2 0 0 0 0-2.83z" />
    <circle cx="8" cy="8" r="1.5" />
  </svg>
);

const pagesIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
  </svg>
);

const menuItemsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);

const redirectsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M4 12h13M12 5l7 7-7 7" />
  </svg>
);

const seoIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4-4M8 11h6" />
  </svg>
);

const synonymsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <circle cx="7" cy="12" r="4" />
    <circle cx="17" cy="12" r="4" />
    <path d="M11 12h2" />
  </svg>
);

const settingsPageIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1L16.5 2h-4l-.4 2.6a7 7 0 0 0-1.7 1l-2.3-1-2 3.4L7.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5c.1-.3.1-.7.1-1z" />
  </svg>
);

const mediaIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.75" />
    <path d="m21 15-5-5L5 21" />
  </svg>
);

const staffIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
    <path d="M15 14c2.8.4 5 2.9 5 6" />
  </svg>
);

const rolesIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const auditLogIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const netProfitIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M3 17 9 11l4 4 8-8" />
    <path d="M15 7h6v6" />
  </svg>
);

const fraudIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5z" />
    <path d="M12 8v5M12 16.5v.01" />
  </svg>
);

const blockerIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <circle cx="12" cy="12" r="9" />
    <path d="m5.5 5.5 13 13" />
  </svg>
);

const orderManagerIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 4v5" />
  </svg>
);

const smsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const paymentsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
  </svg>
);

const recoveryIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M3 12a9 9 0 1 0 2.6-6.3" />
    <path d="M3 4v5h5" />
  </svg>
);

const profitIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M3 3v18h18" />
    <path d="m7 14 4-4 3 3 5-6" />
  </svg>
);

const reportsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <rect x="4" y="10" width="4" height="10" />
    <rect x="10" y="6" width="4" height="14" />
    <rect x="16" y="3" width="4" height="17" />
  </svg>
);

const newsletterIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);

// Data-driven sidebar nav (per DESIGN_SYSTEM.md §4) — real Amader admin
// sections get added here as they're built (see AGENTS.admin.md §10 for the
// full build order). Nothing in AppShell/NavItem hardcodes a nav row; this
// array is the single source of truth for what appears in the sidebar.
// "Overview" is still the style-guide/foundation preview page until a real
// dashboard replaces it.
// Grouped per user request — the flat 27-row list was too much sidebar at
// once. Frequently-touched pages (Orders/Shipments/Reviews/Media/Settings)
// stay top-level; everything else nests under a collapsible group that
// auto-opens when one of its own pages is active.
export const adminNav: AppNavItem[] = [
  { key: "overview", label: "Overview", href: "/", icon: overviewIcon },
  { key: "orders", label: "Orders", href: "/orders", icon: ordersIcon },
  { key: "shipments", label: "Shipments", href: "/shipments", icon: shipmentsIcon },
  {
    key: "catalog",
    label: "Catalog",
    icon: productsIcon,
    children: [
      { key: "products", label: "Products", href: "/products", icon: productsIcon },
      { key: "collections", label: "Collections", href: "/collections", icon: collectionsIcon },
      { key: "product-bundles", label: "Product Bundles", href: "/product-bundles", icon: bundlesIcon },
      { key: "brands", label: "Brands", href: "/brands", icon: brandsIcon },
      { key: "categories", label: "Categories", href: "/categories", icon: categoriesIcon },
      { key: "tags", label: "Tags", href: "/tags", icon: tagsIcon },
      { key: "attributes", label: "Attributes", href: "/attributes", icon: attributesIcon },
    ],
  },
  {
    key: "marketing",
    label: "Marketing",
    icon: discountsIcon,
    children: [
      { key: "homepage-sections", label: "Homepage Sections", href: "/homepage-sections", icon: homepageSectionsIcon },
      { key: "discounts", label: "Discounts", href: "/discounts", icon: discountsIcon },
      { key: "gift-vouchers", label: "Gift Vouchers", href: "/gift-vouchers", icon: giftVouchersIcon },
    ],
  },
  { key: "reviews", label: "Reviews", href: "/reviews", icon: reviewsIcon },
  {
    key: "net-profit",
    label: "Net Profit",
    icon: netProfitIcon,
    children: [
      { key: "net-profit-overview", label: "Overview", href: "/net-profit", icon: netProfitIcon },
      { key: "net-profit-fraud", label: "Courier Fraud Detection", href: "/net-profit/fraud", icon: fraudIcon },
      { key: "net-profit-orders", label: "Order Manager", href: "/net-profit/orders", icon: orderManagerIcon },
      { key: "net-profit-blocker", label: "Order Blocker", href: "/net-profit/blocker", icon: blockerIcon },
      { key: "net-profit-sms", label: "SMS", href: "/net-profit/sms", icon: smsIcon },
      { key: "net-profit-payments", label: "Payments", href: "/net-profit/payments", icon: paymentsIcon },
      { key: "net-profit-recovery", label: "Recovery", href: "/net-profit/recovery", icon: recoveryIcon },
      { key: "net-profit-profit", label: "Profit Manager", href: "/net-profit/profit", icon: profitIcon },
      { key: "net-profit-reports", label: "Sales Report", href: "/net-profit/reports", icon: reportsIcon },
    ],
  },
  {
    key: "content",
    label: "Content",
    icon: blogIcon,
    children: [
      { key: "blog-posts", label: "Blog Posts", href: "/blog-posts", icon: blogIcon },
      { key: "blog-categories", label: "Blog Categories", href: "/blog-categories", icon: blogCategoriesIcon },
      { key: "blog-tags", label: "Blog Tags", href: "/blog-tags", icon: blogTagsIcon },
      { key: "pages", label: "Pages", href: "/pages", icon: pagesIcon },
      { key: "menu-items", label: "Menu Items", href: "/menu-items", icon: menuItemsIcon },
    ],
  },
  {
    key: "seo",
    label: "SEO",
    icon: seoIcon,
    children: [
      { key: "redirects", label: "Redirects", href: "/redirects", icon: redirectsIcon },
      { key: "seo-meta", label: "SEO Meta", href: "/seo-meta", icon: seoIcon },
      { key: "search-synonyms", label: "Search Synonyms", href: "/search-synonyms", icon: synonymsIcon },
    ],
  },
  { key: "media", label: "Media Library", href: "/media", icon: mediaIcon },
  { key: "newsletter", label: "Newsletter", href: "/newsletter", icon: newsletterIcon },
  {
    key: "admin",
    label: "Admin",
    icon: staffIcon,
    children: [
      { key: "staff", label: "Staff", href: "/staff", icon: staffIcon },
      { key: "roles", label: "Roles", href: "/roles", icon: rolesIcon },
      { key: "audit-log", label: "Audit Log", href: "/audit-log", icon: auditLogIcon },
    ],
  },
  { key: "settings", label: "Settings", href: "/settings", icon: settingsPageIcon },
];
