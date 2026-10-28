import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ADMIN_ONLY_PERMISSIONS, PERMISSION_CATALOG } from '@amader/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import {
  PermissionDto,
  RoleDto,
  toPermissionDto,
  toRoleDto,
} from './rbac.mapper';

const ROLE_INCLUDE = {
  permissions: { include: { permission: true } },
} as const;

@Injectable()
export class RbacService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RbacService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Makes sure every permission in PERMISSION_CATALOG exists as a row.
   *
   * The catalog was only ever written to the table by `prisma db seed`, and
   * deploys run migrations, not the seed — so a permission added to the
   * catalog after an environment was first seeded never reached it. That is
   * how production ended up with no `wholesale.*` rows: Roles had nothing to
   * tick, and only a super admin (who bypasses the guard) could open
   * Wholesale. Insert-only and idempotent: it never grants anything, that stays a Roles decision.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      const before = new Set(
        (await this.prisma.client.permission.findMany({ select: { key: true } })).map((p) => p.key),
      );
      const { count } = await this.prisma.client.permission.createMany({
        data: PERMISSION_CATALOG,
        skipDuplicates: true,
      });
      if (count > 0) this.logger.log(`Added ${count} missing permission(s) from the catalog`);
      // A delete/payment/export right appearing for the first time goes to the Admin role
      // only (once — unticking it in Roles later sticks).
      const fresh = ADMIN_ONLY_PERMISSIONS.filter((k) => !before.has(k));
      const admin = fresh.length
        ? await this.prisma.client.role.findFirst({ where: { name: { equals: 'Admin', mode: 'insensitive' } } })
        : null;
      if (admin) {
        const perms = await this.prisma.client.permission.findMany({ where: { key: { in: fresh } } });
        await this.prisma.client.rolePermission.createMany({
          data: perms.map((p) => ({ roleId: admin.id, permissionId: p.id })),
          skipDuplicates: true,
        });
        this.logger.log(`Granted ${fresh.join(', ')} to the Admin role`);
      }
    } catch (err) {
      // Never block startup over this; the next boot tries again.
      this.logger.error(`Permission catalog sync failed: ${(err as Error).message}`);
    }
  }

  async listPermissions(): Promise<PermissionDto[]> {
    const permissions = await this.prisma.client.permission.findMany({
      orderBy: { key: 'asc' },
    });
    return permissions.map(toPermissionDto);
  }

  async listRoles(): Promise<RoleDto[]> {
    const roles = await this.prisma.client.role.findMany({
      include: ROLE_INCLUDE,
      orderBy: { name: 'asc' },
    });
    return roles.map(toRoleDto);
  }

  async getRole(id: number): Promise<RoleDto> {
    const role = await this.prisma.client.role.findUnique({
      where: { id },
      include: ROLE_INCLUDE,
    });
    if (!role) throw new NotFoundException('Role not found');
    return toRoleDto(role);
  }

  async createRole(dto: CreateRoleDto): Promise<RoleDto> {
    const permissionIds = await this.resolvePermissionIds(dto.permissionKeys);
    const role = await this.prisma.client.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        permissions: {
          create: permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
      include: ROLE_INCLUDE,
    });
    return toRoleDto(role);
  }

  async updateRole(id: number, dto: UpdateRoleDto): Promise<RoleDto> {
    await this.getRole(id);

    if (dto.permissionKeys) {
      const permissionIds = await this.resolvePermissionIds(dto.permissionKeys);
      await this.prisma.client.rolePermission.deleteMany({
        where: { roleId: id },
      });
      await this.prisma.client.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: id,
          permissionId,
        })),
      });
    }

    const role = await this.prisma.client.role.update({
      where: { id },
      data: { name: dto.name, description: dto.description },
      include: ROLE_INCLUDE,
    });
    return toRoleDto(role);
  }

  async deleteRole(id: number): Promise<void> {
    const role = await this.getRole(id);
    if (role.isSystem)
      throw new ForbiddenException('System roles cannot be deleted');
    await this.prisma.client.role.delete({ where: { id } });
  }

  private async resolvePermissionIds(
    keys: string[] | undefined,
  ): Promise<number[]> {
    if (!keys || keys.length === 0) return [];
    const permissions = await this.prisma.client.permission.findMany({
      where: { key: { in: keys } },
    });
    if (permissions.length !== keys.length) {
      const found = new Set(permissions.map((p) => p.key));
      const missing = keys.filter((k) => !found.has(k));
      throw new BadRequestException(
        `Unknown permission key(s): ${missing.join(', ')}`,
      );
    }
    return permissions.map((p) => p.id);
  }
}
