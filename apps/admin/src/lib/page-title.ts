// AppShell needs a single page title string, but title only really varies by
// route — a small lookup here beats threading a title prop through every
// page/layout in the tree.
const SECTIONS: { base: string; label: string }[] = [
  { base: "/orders", label: "Orders" },
  { base: "/shipments", label: "Shipments" },
  { base: "/products", label: "Products" },
  { base: "/homepage-sections", label: "Homepage Sections" },
  { base: "/brands", label: "Brands" },
  { base: "/categories", label: "Categories" },
  { base: "/tags", label: "Tags" },
  { base: "/attributes", label: "Attributes" },
  { base: "/collections", label: "Collections" },
  { base: "/product-bundles", label: "Product Bundles" },
  { base: "/discounts", label: "Discounts" },
  { base: "/gift-vouchers", label: "Gift Vouchers" },
  { base: "/reviews", label: "Reviews" },
  { base: "/blog-posts", label: "Blog Posts" },
  { base: "/blog-categories", label: "Blog Categories" },
  { base: "/blog-tags", label: "Blog Tags" },
  { base: "/pages", label: "Pages" },
  { base: "/menu-items", label: "Menu Items" },
  { base: "/redirects", label: "Redirects" },
  { base: "/seo-meta", label: "SEO Meta" },
  { base: "/search-synonyms", label: "Search Synonyms" },
  { base: "/settings", label: "Settings" },
  { base: "/media", label: "Media Library" },
  { base: "/staff", label: "Staff" },
  { base: "/roles", label: "Roles" },
  { base: "/audit-log", label: "Audit Log" },
  { base: "/newsletter", label: "Newsletter" },
  { base: "/net-profit/fraud", label: "Courier Fraud Detection" },
  { base: "/net-profit/orders", label: "Order Manager" },
  { base: "/net-profit/blocker", label: "Order Blocker" },
  { base: "/net-profit/sms", label: "SMS" },
  { base: "/net-profit/payments", label: "Payments" },
  { base: "/net-profit/recovery", label: "Recovery" },
  { base: "/net-profit/reports", label: "Sales Report" },
  { base: "/net-profit", label: "Net Profit" },
];

export function pageTitleFor(pathname: string): string {
  if (pathname === "/") return "Overview";
  if (pathname.startsWith("/orders/")) return "Order Details"; // viewed/actioned, not "edited"

  const section = SECTIONS.find((s) => pathname === s.base || pathname.startsWith(`${s.base}/`));
  if (!section) return "Amader Admin";
  if (pathname === section.base) return section.label;
  if (pathname === `${section.base}/new`) return `New ${section.label.replace(/s$/, "")}`;
  return `Edit ${section.label.replace(/s$/, "")}`;
}
