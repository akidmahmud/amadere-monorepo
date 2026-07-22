import { Icon } from "@amader/admin-ui";
import type { AppNavEntry } from "@amader/admin-ui";

// Material Symbols (see packages/admin-ui's Icon component) — one name per
// nav row instead of a hand-rolled <svg>, ported 1:1 so every existing
// reference below (adminNav) needs no changes beyond this block.
const overviewIcon = <Icon name="dashboard" />;
const productsIcon = <Icon name="inventory_2" />;
const homepageSectionsIcon = <Icon name="view_agenda" />;
const brandsIcon = <Icon name="storefront" />;
const categoriesIcon = <Icon name="category" />;
const tagsIcon = <Icon name="sell" />;
const attributesIcon = <Icon name="tune" />;
const collectionsIcon = <Icon name="collections_bookmark" />;
const bundlesIcon = <Icon name="inventory" />;
const newOrderIcon = <Icon name="add_shopping_cart" />;
const shipmentsIcon = <Icon name="local_shipping" />;
const discountsIcon = <Icon name="local_offer" />;
const giftVouchersIcon = <Icon name="card_giftcard" />;
const reviewsIcon = <Icon name="star" />;
const blogIcon = <Icon name="article" />;
const blogCategoriesIcon = <Icon name="topic" />;
const blogTagsIcon = <Icon name="label" />;
const pagesIcon = <Icon name="description" />;
const menuItemsIcon = <Icon name="menu" />;
const announcementsIcon = <Icon name="campaign" />;
const redirectsIcon = <Icon name="alt_route" />;
const seoIcon = <Icon name="search" />;
const synonymsIcon = <Icon name="sync_alt" />;
const settingsPageIcon = <Icon name="settings" />;
const mediaIcon = <Icon name="perm_media" />;
const staffIcon = <Icon name="group" />;
const rolesIcon = <Icon name="admin_panel_settings" />;
const auditLogIcon = <Icon name="history" />;
const netProfitIcon = <Icon name="trending_up" />;
const fraudIcon = <Icon name="gpp_maybe" />;
const blockerIcon = <Icon name="block" />;
const orderManagerIcon = <Icon name="list_alt" />;
const smsIcon = <Icon name="sms" />;
const paymentsIcon = <Icon name="payments" />;
const recoveryIcon = <Icon name="shopping_cart_checkout" />;
const reportsIcon = <Icon name="bar_chart" />;
const accountsIcon = <Icon name="account_balance" />;
const newsletterIcon = <Icon name="mail" />;
const customersIcon = <Icon name="people" />;
const customerTiersIcon = <Icon name="military_tech" />;
const customerImportIcon = <Icon name="upload_file" />;
const analyticsIcon = <Icon name="monitoring" />;
const whatsappIcon = <Icon name="chat" />;

function label(key: string, text: string): AppNavEntry {
  return { type: "label", key, label: text };
}

// Data-driven sidebar nav (per DESIGN_SYSTEM.md §4) — real Amader admin
// sections get added here as they're built (see AGENTS.admin.md §10 for the
// full build order). Nothing in AppShell/NavItem hardcodes a nav row; this
// array is the single source of truth for what appears in the sidebar.
//
// Flat, per the GetCommerce reference (getcommerce-dashboard.html): every
// page is one click away under a plain section label, no collapsible
// dropdown groups (the reference has none — its chevron accents are static
// decoration on the mockup, not real toggle behavior).
export const adminNav: AppNavEntry[] = [
  { key: "overview", label: "Overview", href: "/", icon: overviewIcon },

  label("orders-label", "Orders & Fulfillment"),
  { key: "new-order", label: "New Order", href: "/orders/new", icon: newOrderIcon },
  { key: "shipments", label: "Shipments", href: "/shipments", icon: shipmentsIcon },

  label("catalog-label", "Product Management"),
  { key: "products", label: "Products", href: "/products", icon: productsIcon },
  { key: "collections", label: "Collections", href: "/collections", icon: collectionsIcon },
  { key: "product-bundles", label: "Product Bundles", href: "/product-bundles", icon: bundlesIcon },
  { key: "brands", label: "Brands", href: "/brands", icon: brandsIcon },
  { key: "categories", label: "Categories", href: "/categories", icon: categoriesIcon },
  { key: "tags", label: "Tags", href: "/tags", icon: tagsIcon },
  { key: "attributes", label: "Attributes", href: "/attributes", icon: attributesIcon },

  label("marketing-label", "Marketing"),
  { key: "homepage-sections", label: "Homepage Sections", href: "/homepage-sections", icon: homepageSectionsIcon },
  { key: "discounts", label: "Discounts", href: "/discounts", icon: discountsIcon },
  { key: "gift-vouchers", label: "Gift Vouchers", href: "/gift-vouchers", icon: giftVouchersIcon },
  { key: "whatsapp", label: "WhatsApp", href: "/whatsapp", icon: whatsappIcon },
  { key: "reviews", label: "Reviews", href: "/reviews", icon: reviewsIcon },

  label("net-profit-label", "Net Profit"),
  { key: "net-profit-overview", label: "Overview", href: "/net-profit", icon: netProfitIcon },
  { key: "net-profit-fraud", label: "Courier Fraud Detection", href: "/net-profit/fraud", icon: fraudIcon },
  { key: "net-profit-orders", label: "Order Manager", href: "/net-profit/orders", icon: orderManagerIcon },
  { key: "net-profit-blocker", label: "Order Blocker", href: "/net-profit/blocker", icon: blockerIcon },
  { key: "net-profit-sms", label: "SMS", href: "/net-profit/sms", icon: smsIcon },
  { key: "net-profit-payments", label: "Payments", href: "/net-profit/payments", icon: paymentsIcon },
  { key: "net-profit-recovery", label: "Recovery", href: "/net-profit/recovery", icon: recoveryIcon },
  { key: "net-profit-reports", label: "Sales Report", href: "/net-profit/reports", icon: reportsIcon },
  { key: "net-profit-accounts", label: "Accounts", href: "/net-profit/accounts", icon: accountsIcon },

  label("customers-label", "Customers"),
  { key: "customers-list", label: "All Customers", href: "/customers", icon: customersIcon },
  { key: "customers-tiers", label: "Tiers", href: "/customers/tiers", icon: customerTiersIcon },
  { key: "customers-import", label: "Import CSV", href: "/customers/import", icon: customerImportIcon },

  label("content-label", "Content"),
  { key: "blog-posts", label: "Blog Posts", href: "/blog-posts", icon: blogIcon },
  { key: "blog-categories", label: "Blog Categories", href: "/blog-categories", icon: blogCategoriesIcon },
  { key: "blog-tags", label: "Blog Tags", href: "/blog-tags", icon: blogTagsIcon },
  { key: "pages", label: "Pages", href: "/pages", icon: pagesIcon },
  { key: "menu-items", label: "Menu Items", href: "/menu-items", icon: menuItemsIcon },
  { key: "announcements", label: "Announcements", href: "/announcements", icon: announcementsIcon },

  label("seo-label", "SEO"),
  { key: "redirects", label: "Redirects", href: "/redirects", icon: redirectsIcon },
  { key: "seo-meta", label: "SEO Meta", href: "/seo-meta", icon: seoIcon },
  { key: "search-synonyms", label: "Search Synonyms", href: "/search-synonyms", icon: synonymsIcon },

  label("insights-label", "Insights"),
  { key: "analytics", label: "Analytics", href: "/analytics", icon: analyticsIcon },
  { key: "media", label: "Media Library", href: "/media", icon: mediaIcon },
  { key: "newsletter", label: "Newsletter", href: "/newsletter", icon: newsletterIcon },

  label("admin-label", "Admin"),
  { key: "staff", label: "Staff", href: "/staff", icon: staffIcon },
  { key: "roles", label: "Roles", href: "/roles", icon: rolesIcon },
  { key: "audit-log", label: "Audit Log", href: "/audit-log", icon: auditLogIcon },
  { key: "settings", label: "Settings", href: "/settings", icon: settingsPageIcon },
];
