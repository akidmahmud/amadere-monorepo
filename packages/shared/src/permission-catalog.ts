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

  perm('shipment', 'view'),
  perm('shipment', 'dispatch'),
  perm('shipment', 'update'),

  perm('review', 'view'),
  perm('review', 'moderate'),
  perm('review', 'reply'),

  perm('newsletter', 'view'),
];
