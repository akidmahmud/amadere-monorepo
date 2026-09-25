import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { PermissionCheck } from '../../common/auth/permission.decorator';

/**
 * Which store a request acts on. null = every store (reports only).
 * A user without pos.all_stores is always pinned to their own store,
 * whatever storeId they pass.
 */
export function resolveStoreScope(
  admin: { storeId: number | null },
  can: PermissionCheck,
  requested?: number,
): number | null {
  if (can('pos.all_stores')) return requested ?? null;
  if (admin.storeId === null)
    throw new ForbiddenException('No store assigned — ask an admin');
  return admin.storeId;
}

export function requireOneStore(scope: number | null): number {
  if (scope === null) throw new BadRequestException('Choose a store');
  return scope;
}

/** An inactive store keeps its history but can't sell or move stock. */
export function assertStoreActive(store: {
  isActive?: boolean;
  name?: string;
}): void {
  if (store.isActive === false) {
    throw new BadRequestException(`${store.name ?? 'This store'} is inactive`);
  }
}
