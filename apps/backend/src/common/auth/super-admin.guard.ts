import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestWithAdmin } from './admin-jwt.guard';

// Distinct from PermissionGuard: a granted permission is never enough here
// (RequirePermission + isSuperAdmin both pass PermissionGuard, but this
// guard exists specifically for actions — e.g. restoring a deleted product
// — that must stay super-admin-only regardless of what permissions a
// regular admin has been granted). Pair with AdminJwtGuard, same as
// PermissionGuard, so `request.adminUser.id` is already populated.
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const admin = await this.prisma.client.adminUser.findUniqueOrThrow({
      where: { id: request.adminUser.id },
      select: { isSuperAdmin: true },
    });
    if (!admin.isSuperAdmin) {
      throw new ForbiddenException('Super admin access required');
    }
    return true;
  }
}
