import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginationArgs, toPaginatedResult } from '../pagination.util';

export interface RecordAuditLogInput {
  adminUserId: number | null;
  action: string;
  entityType: string;
  entityId?: number;
  entityLabel?: string;
  changes?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogFilters {
  entityType?: string;
  entityId?: number;
  adminUserId?: number;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditLogInput): Promise<void> {
    await this.prisma.client.auditLog.create({
      data: {
        adminUserId: input.adminUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        entityLabel: input.entityLabel,
        changes:
          input.changes === undefined ? undefined : (input.changes as object),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  async adminList(filters: AuditLogFilters, page: number, pageSize: number) {
    const where = {
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.entityId !== undefined ? { entityId: filters.entityId } : {}),
      ...(filters.adminUserId !== undefined
        ? { adminUserId: filters.adminUserId }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.auditLog.count({ where }),
    ]);
    return toPaginatedResult(items, total, page, pageSize);
  }
}
