import { Body, Controller, Get, Post, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { CleanupService, CleanupSettings } from './cleanup.service';

@ApiTags('admin/net-profit/cleanup')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/cleanup')
export class AdminCleanupController {
  constructor(private readonly cleanup: CleanupService) {}

  @Get('settings')
  @RequirePermission('net_profit_settings.manage')
  getSettings() {
    return this.cleanup.getSettings();
  }

  @Put('settings')
  @RequirePermission('net_profit_settings.manage')
  updateSettings(@Body() dto: Partial<CleanupSettings>) {
    return this.cleanup.updateSettings(dto);
  }

  @Post('run')
  @RequirePermission('net_profit_settings.manage')
  run() {
    return this.cleanup.runNow();
  }
}
