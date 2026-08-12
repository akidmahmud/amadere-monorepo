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
const trashIcon = <Icon name="delete" />;
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
const newsletterCampaignsIcon = <Icon name="campaign" />;
const newsletterTemplatesIcon = <Icon name="dashboard_customize" />;
const newsletterSegmentsIcon = <Icon name="groups" />;
const customersIcon = <Icon name="people" />;
const customerTiersIcon = <Icon name="military_tech" />;
const analyticsIcon = <Icon name="monitoring" />;
const whatsappIcon = <Icon name="chat" />;
const promoVideosIcon = <Icon name="smart_display" />;
const documentationIcon = <Icon name="menu_book" />;

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
  { key: "overview", label: "Overview", href: "/", icon: overviewIcon, permission: "dashboard.view" },

  label("orders-label", "Orders & Fulfillment"),
  { key: "new-order", label: "New Order", href: "/orders/new", icon: newOrderIcon, permission: "order.create" },
  { key: "shipments", label: "Shipments", href: "/shipments", icon: shipmentsIcon, permission: "shipment.view" },

  label("catalog-label", "Product Management"),
  { key: "products", label: "Products", href: "/products", icon: productsIcon, permission: "product.view" },
  { key: "products-trash", label: "Deleted Products", href: "/products/trash", icon: trashIcon, permission: "product.view" },
  { key: "collections", label: "Collections", href: "/collections", icon: collectionsIcon, permission: "collection.view" },
  { key: "brands", label: "Brands", href: "/brands", icon: brandsIcon, permission: "brand.view" },
  { key: "categories", label: "Categories", href: "/categories", icon: categoriesIcon, permission: "category.view" },
  { key: "tags", label: "Tags", href: "/tags", icon: tagsIcon, permission: "tag.view" },
  { key: "attributes", label: "Attributes", href: "/attributes", icon: attributesIcon, permission: "attribute.view" },

  label("marketing-label", "Marketing"),
  { key: "newsletter-campaigns", label: "Newsletter Campaigns", href: "/newsletter-campaigns", icon: newsletterCampaignsIcon, permission: "newsletter_campaign.view" },
  { key: "newsletter-templates", label: "Newsletter Templates", href: "/newsletter-templates", icon: newsletterTemplatesIcon, permission: "newsletter_template.view" },
  { key: "newsletter-segments", label: "Newsletter Segments", href: "/newsletter-segments", icon: newsletterSegmentsIcon, permission: "newsletter_segment.view" },
  { key: "homepage-sections", label: "Homepage Sections", href: "/homepage-sections", icon: homepageSectionsIcon, permission: "homepage_section.view" },
  { key: "promo-videos", label: "Promo Videos", href: "/promo-videos", icon: promoVideosIcon, permission: "promo_video.view" },
  { key: "discounts", label: "Discounts", href: "/discounts", icon: discountsIcon, permission: "discount.view" },
  { key: "gift-vouchers", label: "Gift Vouchers", href: "/gift-vouchers", icon: giftVouchersIcon, permission: "gift_voucher.view" },
  { key: "whatsapp", label: "WhatsApp", href: "/whatsapp", icon: whatsappIcon, permission: "whatsapp.view" },
  { key: "reviews", label: "Reviews", href: "/reviews", icon: reviewsIcon, permission: "review.view" },

  label("net-profit-label", "Net Profit"),
  { key: "net-profit-overview", label: "Overview", href: "/net-profit", icon: netProfitIcon, permission: "net_profit_overview.view" },
  { key: "net-profit-fraud", label: "Courier Fraud Detection", href: "/net-profit/fraud", icon: fraudIcon, permission: "net_profit_fraud.view" },
  { key: "net-profit-orders", label: "Order Manager", href: "/net-profit/orders", icon: orderManagerIcon, permission: "net_profit_orders.view" },
  { key: "net-profit-blocker", label: "Order Blocker", href: "/net-profit/blocker", icon: blockerIcon, permission: "net_profit_blocker.manage" },
  { key: "net-profit-sms", label: "SMS", href: "/net-profit/sms", icon: smsIcon, permission: "net_profit_sms.view" },
  { key: "net-profit-payments", label: "Payments", href: "/net-profit/payments", icon: paymentsIcon, permission: "net_profit_advance.manage" },
  { key: "net-profit-recovery", label: "Recovery", href: "/net-profit/recovery", icon: recoveryIcon, permission: "net_profit_recovery.manage" },
  { key: "net-profit-reports", label: "Sales Report", href: "/net-profit/reports", icon: reportsIcon, permission: "net_profit_reports.view" },
  { key: "net-profit-accounts", label: "Accounts", href: "/net-profit/accounts", icon: accountsIcon, permission: "net_profit_accounts.view" },

  label("customers-label", "Customers"),
  { key: "customers-list", label: "All Customers", href: "/customers", icon: customersIcon, permission: "customer.view" },
  { key: "customers-tiers", label: "Tiers", href: "/customers/tiers", icon: customerTiersIcon, permission: "customer.view" },

  label("content-label", "Content"),
  { key: "blog-posts", label: "Blog Posts", href: "/blog-posts", icon: blogIcon, permission: "blog_post.view" },
  { key: "blog-posts-trash", label: "Deleted Blog Posts", href: "/blog-posts/trash", icon: trashIcon, permission: "blog_post.view" },
  { key: "blog-categories", label: "Blog Categories", href: "/blog-categories", icon: blogCategoriesIcon, permission: "blog_category.view" },
  { key: "blog-tags", label: "Blog Tags", href: "/blog-tags", icon: blogTagsIcon, permission: "blog_tag.view" },
  { key: "pages", label: "Pages", href: "/pages", icon: pagesIcon, permission: "page.view" },
  { key: "menu-items", label: "Menu Items", href: "/menu-items", icon: menuItemsIcon, permission: "menu_item.view" },
  { key: "announcements", label: "Announcements", href: "/announcements", icon: announcementsIcon, permission: "announcement.view" },

  label("seo-label", "SEO"),
  { key: "redirects", label: "Redirects", href: "/redirects", icon: redirectsIcon, permission: "redirect.view" },
  { key: "seo-meta", label: "SEO Meta", href: "/seo-meta", icon: seoIcon, permission: "seo_meta.view" },
  { key: "search-synonyms", label: "Search Synonyms", href: "/search-synonyms", icon: synonymsIcon, permission: "search_synonym.view" },

  label("insights-label", "Insights"),
  { key: "analytics", label: "Analytics", href: "/analytics", icon: analyticsIcon, permission: "analytics.view" },
  { key: "media", label: "Media Library", href: "/media", icon: mediaIcon, permission: "media.view" },
  { key: "newsletter", label: "Newsletter", href: "/newsletter", icon: newsletterIcon, permission: "newsletter.view" },

  label("admin-label", "Admin"),
  { key: "staff", label: "Staff", href: "/staff", icon: staffIcon, permission: "staff.view" },
  { key: "roles", label: "Roles", href: "/roles", icon: rolesIcon, permission: "role.view" },
  { key: "audit-log", label: "Audit Log", href: "/audit-log", icon: auditLogIcon, permission: "audit_log.view" },
  { key: "settings", label: "Settings", href: "/settings", icon: settingsPageIcon, permission: "setting.view" },
  // No permission gate — a static docs page every admin can read regardless
  // of role; unlike every other row above, nothing backs it with a
  // permission-guarded API call.
  { key: "documentation", label: "Documentation", href: "/documentation", icon: documentationIcon },
];
