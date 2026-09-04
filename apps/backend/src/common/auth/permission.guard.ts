import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSION_KEY } from './permission.decorator';
import { RequestWithAdmin } from './admin-jwt.guard';

interface CachedPermissions {
  isSuperAdmin: boolean;
  granted: Set<string>;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;

// Runs after AdminJwtGuard — always pair as @UseGuards(AdminJwtGuard, PermissionGuard).
//
// Every @RequirePermission-guarded request used to do a full 3-level-join DB
// query (admin -> roles -> role -> permissions -> permission) before the
// actual handler ran — a single admin page load fires several guarded calls
// in parallel, so this was multiplying DB round-trips on every navigation.
// Role/permission assignments change rarely (an admin action, not a customer
// one), so an in-memory cache keyed by admin user id — this guard is a
// singleton, so a plain class field survives across requests — with a short
// TTL is a safe trade: up to 60s of staleness after a permission change,
// against a real DB round-trip removed from every guarded call. Not wired to
// invalidate on role edits; 60s is short enough that this hasn't been worth
// the extra coupling.
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly cache = new Map<number, CachedPermissions>();

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Tolerates the old single-string metadata as well as the array
    // RequirePermission now sets, so a stale compiled handler cannot silently
    // become unguarded.
    const meta = this.reflector.get<string | string[] | undefined>(
      PERMISSION_KEY,
      context.getHandler(),
    );
    const required = meta === undefined ? [] : Array.isArray(meta) ? meta : [meta];
    if (required.length === 0) return true;

    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const resolved = await this.getPermissions(request.adminUser.id);
    const { isSuperAdmin, granted } = resolved;
    // Published for @Can(), which handles the checks a decorator cannot express
    // (one field on a shared update endpoint, one action inside a bulk call).
    request.adminPermissions = { isSuperAdmin, granted };

    if (isSuperAdmin) return true;
    const missing = required.filter((key) => !granted.has(key));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing permission: ${missing.join(', ')}`);
    }
    return true;
  }

  private async getPermissions(adminUserId: number): Promise<CachedPermissions> {
    const cached = this.cache.get(adminUserId);
    if (cached && cached.expiresAt > Date.now()) return cached;

    const admin = await this.prisma.client.adminUser.findUniqueOrThrow({
      where: { id: adminUserId },
      select: {
        isSuperAdmin: true,
        roles: {
          select: {
            role: {
              select: {
                permissions: {
                  select: { permission: { select: { key: true } } },
                },
              },
            },
          },
        },
      },
    });

    const entry: CachedPermissions = {
      isSuperAdmin: admin.isSuperAdmin,
      granted: new Set(
        admin.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key)),
      ),
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    this.cache.set(adminUserId, entry);
    return entry;
  }
}
