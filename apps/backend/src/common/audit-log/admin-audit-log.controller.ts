import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/permission.decorator';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { AuditLogService } from './audit-log.service';

@ApiTags('admin/audit-log')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@Controller('admin/audit-log')
export class AdminAuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  @RequirePermission('audit_log.view')
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'entityId', required: false, type: Number })
  @ApiQuery({ name: 'adminUserId', required: false, type: Number })
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('adminUserId') adminUserId?: string,
  ) {
    return this.auditLog.adminList(
      {
        entityType,
        entityId: entityId ? Number(entityId) : undefined,
        adminUserId: adminUserId ? Number(adminUserId) : undefined,
      },
      page ?? 1,
      pageSize ?? 20,
    );
  }
}
