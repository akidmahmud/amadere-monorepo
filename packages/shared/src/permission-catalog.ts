export interface PermissionDefinition {
  resource: string;
  action: string;
  key: string;
}

function perm(resource: string, action: string): PermissionDefinition {
  return { resource, action, key: `${resource}.${action}` };
}

// Seeded into the Permission table by packages/db/prisma/seed.ts. Every new
// feature module appends its own resource.action entries here (AGENTS.md §7)
// — roles then pick new permissions up with zero bespoke auth wiring.
export const PERMISSION_CATALOG: PermissionDefinition[] = [
  perm('role', 'view'),
  perm('role', 'create'),
  perm('role', 'update'),
  perm('role', 'delete'),
  perm('permission', 'view'),
  perm('staff', 'view'),
  perm('staff', 'create'),
  perm('staff', 'update'),
  perm('staff', 'delete'),
  perm('audit_log', 'view'),

  perm('media', 'view'),
  perm('media', 'upload'),
  perm('media', 'delete'),

  perm('brand', 'view'),
  perm('brand', 'create'),
  perm('brand', 'update'),
  perm('brand', 'delete'),

  perm('category', 'view'),
  perm('category', 'create'),
  perm('category', 'update'),
  perm('category', 'delete'),

  perm('tag', 'view'),
  perm('tag', 'create'),
  perm('tag', 'update'),
  perm('tag', 'delete'),

  perm('attribute', 'view'),
  perm('attribute', 'create'),
  perm('attribute', 'update'),
  perm('attribute', 'delete'),

  perm('product', 'view'),
  perm('product', 'create'),
  perm('product', 'update'),
  perm('product', 'delete'),

  perm('product_bundle', 'view'),
  perm('product_bundle', 'create'),
  perm('product_bundle', 'update'),
  perm('product_bundle', 'delete'),

  perm('search_synonym', 'view'),
  perm('search_synonym', 'create'),
  perm('search_synonym', 'update'),
  perm('search_synonym', 'delete'),

  perm('discount', 'view'),
  perm('discount', 'create'),
  perm('discount', 'update'),
  perm('discount', 'delete'),

  perm('gift_voucher', 'view'),
  perm('gift_voucher', 'create'),
  perm('gift_voucher', 'update'),
  perm('gift_voucher', 'delete'),

  perm('order', 'view'),
  perm('order', 'update'),
  perm('order', 'refund'),
  perm('order', 'create'),

  perm('shipment', 'view'),
  perm('shipment', 'dispatch'),
  perm('shipment', 'update'),
  perm('shipment', 'manage'),

  perm('analytics', 'view'),
  perm('analytics', 'manage'),

  perm('whatsapp', 'view'),
  perm('whatsapp', 'manage'),

  perm('review', 'view'),
  perm('review', 'moderate'),
  perm('review', 'reply'),

  perm('newsletter', 'view'),

  perm('blog_category', 'view'),
  perm('blog_category', 'create'),
  perm('blog_category', 'update'),
  perm('blog_category', 'delete'),

  perm('blog_tag', 'view'),
  perm('blog_tag', 'create'),
  perm('blog_tag', 'update'),
  perm('blog_tag', 'delete'),

  perm('blog_post', 'view'),
  perm('blog_post', 'create'),
  perm('blog_post', 'update'),
  perm('blog_post', 'delete'),
  perm('blog_post', 'publish'),

  perm('page', 'view'),
  perm('page', 'create'),
  perm('page', 'update'),
  perm('page', 'delete'),

  perm('seo_meta', 'view'),
  perm('seo_meta', 'update'),
  perm('seo_meta', 'delete'),

  perm('redirect', 'view'),
  perm('redirect', 'create'),
  perm('redirect', 'update'),
  perm('redirect', 'delete'),

  perm('setting', 'view'),
  perm('setting', 'update'),

  perm('menu_item', 'view'),
  perm('menu_item', 'create'),
  perm('menu_item', 'update'),
  perm('menu_item', 'delete'),

  perm('announcement', 'view'),
  perm('announcement', 'create'),
  perm('announcement', 'update'),
  perm('announcement', 'delete'),

  perm('marketing_review', 'view'),
  perm('marketing_review', 'create'),
  perm('marketing_review', 'update'),
  perm('marketing_review', 'delete'),

  perm('collection', 'view'),
  perm('collection', 'create'),
  perm('collection', 'update'),
  perm('collection', 'delete'),

  perm('homepage_section', 'view'),
  perm('homepage_section', 'create'),
  perm('homepage_section', 'update'),
  perm('homepage_section', 'delete'),

  perm('dashboard', 'view'),

  perm('net_profit_overview', 'view'),
  perm('net_profit_fraud', 'view'),
  perm('net_profit_fraud', 'manage'),
  perm('net_profit_courier', 'manage'),
  perm('net_profit_sms', 'view'),
  perm('net_profit_sms', 'manage'),
  perm('net_profit_advance', 'manage'),
  perm('net_profit_blocker', 'manage'),
  perm('net_profit_recovery', 'manage'),
  perm('net_profit_orders', 'view'),
  perm('net_profit_orders', 'manage'),
  perm('net_profit_reports', 'view'),
  perm('net_profit_profit', 'view'),
  perm('net_profit_profit', 'manage'),
  perm('net_profit_payments', 'verify'),
  perm('net_profit_settings', 'manage'),
  perm('net_profit_accounts', 'view'),
  perm('net_profit_accounts', 'manage'),

  perm('customer', 'view'),
  perm('customer', 'manage'),
];
