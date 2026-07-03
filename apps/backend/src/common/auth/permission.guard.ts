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

// Runs after AdminJwtGuard — always pair as @UseGuards(AdminJwtGuard, PermissionGuard).
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<string | undefined>(
      PERMISSION_KEY,
      context.getHandler(),
    );
    if (!required) return true;

    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const admin = await this.prisma.client.adminUser.findUniqueOrThrow({
      where: { id: request.adminUser.id },
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

    if (admin.isSuperAdmin) return true;

    const granted = admin.roles.flatMap((r) =>
      r.role.permissions.map((p) => p.permission.key),
    );
    if (!granted.includes(required)) {
      throw new ForbiddenException(`Missing permission: ${required}`);
    }
    return true;
  }
}
