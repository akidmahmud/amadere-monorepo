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
];
