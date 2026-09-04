import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { RequestWithAdmin } from './admin-jwt.guard';

export const PERMISSION_KEY = 'permission';

/**
 * Every listed permission is required — AND, not OR.
 *
 * Multiple keys exist for actions that are a narrower slice of a broader one:
 * changing who an order is assigned to needs both `net_profit_orders.manage`
 * (you may edit orders at all) and `assignment.manage` (you may hand work to
 * someone else). Single-key callers are unchanged.
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSION_KEY, permissions);

/**
 * `(key) => boolean` for the current admin, for rules a decorator cannot
 * express — a field on a shared update endpoint, or one action inside a bulk
 * handler. Populated by PermissionGuard, so it only works on a handler that
 * already carries a @RequirePermission.
 */
export const Can = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithAdmin>();
  const resolved = request.adminPermissions;
  return (key: string): boolean =>
    !!resolved && (resolved.isSuperAdmin || resolved.granted.has(key));
});

export type PermissionCheck = (key: string) => boolean;
