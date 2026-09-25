import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ContentStatus } from '@amader/db';
import type { PermissionCheck } from '../../common/auth/permission.decorator';

export interface ProductActor {
  storeId: number | null;
  can: PermissionCheck;
}

/** For callers with no admin in hand (CSV import, seeds): full rights. */
export const SYSTEM_ACTOR: ProductActor = { storeId: null, can: () => true };

/**
 * A store-only product is ADMIN_ONLY by definition: that status is what keeps
 * it off the storefront (listing, PDP, search, sitemap, feed, customer carts).
 */
export function applyStoreOnlyRules(
  dto: { storeId?: number | null; status?: ContentStatus },
  actor: ProductActor,
  existingStoreId: number | null,
): { storeId: number | null | undefined; status: ContentStatus | undefined } {
  const storeId = dto.storeId !== undefined ? dto.storeId : existingStoreId;
  if (storeId === null) {
    // Turning a store product into a shared one affects every store.
    if (existingStoreId !== null && !actor.can('pos.all_stores')) {
      throw new ForbiddenException(
        'Only an all-stores admin can share a store product',
      );
    }
    return { storeId: dto.storeId, status: dto.status };
  }
  if (dto.status && dto.status !== 'ADMIN_ONLY') {
    throw new BadRequestException(
      'A store-only product cannot be published to the website',
    );
  }
  // Not changing which store sells it (an ordinary edit by a catalog editor)
  // needs no POS permission; assigning a store does.
  const allowed =
    dto.storeId === undefined ||
    actor.can('pos.all_stores') ||
    (actor.can('pos.store_products') && actor.storeId === storeId);
  if (!allowed)
    throw new ForbiddenException(
      'You can only add products for your own store',
    );
  return { storeId: dto.storeId, status: 'ADMIN_ONLY' };
}
