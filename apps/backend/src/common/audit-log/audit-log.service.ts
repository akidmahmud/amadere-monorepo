import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}
