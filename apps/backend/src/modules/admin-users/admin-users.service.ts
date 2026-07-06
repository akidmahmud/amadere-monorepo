import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { hashPassword } from '../../common/auth/password.util';
import {
  paginationArgs,
  toPaginatedResult,
} from '../../common/pagination.util';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import {
  AdminLoginHistoryEntryDto,
  AdminUserDto,
  toAdminUserDto,
} from './admin-users.mapper';

const ADMIN_USER_INCLUDE = { roles: { include: { role: true } } } as const;

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AdminUserDto[]> {
    const admins = await this.prisma.client.adminUser.findMany({
      where: { deletedAt: null },
      include: ADMIN_USER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return admins.map(toAdminUserDto);
  }

  async get(id: number): Promise<AdminUserDto> {
    const admin = await this.prisma.client.adminUser.findFirst({
      where: { id, deletedAt: null },
      include: ADMIN_USER_INCLUDE,
    });
    if (!admin) throw new NotFoundException('Admin user not found');
    return toAdminUserDto(admin);
  }

  async create(dto: CreateAdminUserDto): Promise<AdminUserDto> {
    const passwordHash = await hashPassword(dto.password);
    const admin = await this.prisma.client.adminUser.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        roles: { create: (dto.roleIds ?? []).map((roleId) => ({ roleId })) },
      },
      include: ADMIN_USER_INCLUDE,
    });
    return toAdminUserDto(admin);
  }

  async update(id: number, dto: UpdateAdminUserDto): Promise<AdminUserDto> {
    await this.get(id);

    if (dto.roleIds) {
      await this.prisma.client.adminUserRole.deleteMany({
        where: { adminUserId: id },
      });
      await this.prisma.client.adminUserRole.createMany({
        data: dto.roleIds.map((roleId) => ({ adminUserId: id, roleId })),
      });
    }

    const admin = await this.prisma.client.adminUser.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        status: dto.status,
      },
      include: ADMIN_USER_INCLUDE,
    });
    return toAdminUserDto(admin);
  }

  async softDelete(id: number): Promise<void> {
    await this.get(id);
    await this.prisma.client.adminUser.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'DISABLED' },
    });
  }

  // Recorded on every login attempt since B2 (admin-auth.service.ts) but
  // never previously readable — closing that gap here (AGENTS.md §6 "login
  // history").
  async loginHistory(
    id: number,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<AdminLoginHistoryEntryDto>> {
    await this.get(id);
    const where = { adminUserId: id };
    const [items, total] = await Promise.all([
      this.prisma.client.adminLoginHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.adminLoginHistory.count({ where }),
    ]);
    return toPaginatedResult(
      items.map((h) => ({
        id: h.id,
        ipAddress: h.ipAddress,
        userAgent: h.userAgent,
        success: h.success,
        createdAt: h.createdAt,
      })),
      total,
      page,
      pageSize,
    );
  }
}
