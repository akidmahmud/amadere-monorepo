import { Body, Controller, Get, Param, ParseBoolPipe, ParseIntPipe, Post, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { RecoveryService } from './recovery.service';

@ApiTags('admin/net-profit/recovery')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/recovery')
export class AdminRecoveryController {
  constructor(private readonly recovery: RecoveryService) {}

  @Get()
  @RequirePermission('net_profit_recovery.manage')
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('recovered', new ParseBoolPipe({ optional: true })) recovered?: boolean,
  ) {
    return this.recovery.list(page ?? 1, pageSize ?? 20, recovered);
  }

  @Get('rate')
  @RequirePermission('net_profit_recovery.manage')
  rate() {
    return this.recovery.recoveryRate();
  }

  @Post(':id/send')
  @RequirePermission('net_profit_recovery.manage')
  async send(@Param('id', ParseIntPipe) id: number) {
    await this.recovery.sendRecovery(id);
    return { success: true };
  }

  @Get('settings')
  @RequirePermission('net_profit_recovery.manage')
  getSettings() {
    return this.recovery.getSettings();
  }

  @Put('settings')
  @RequirePermission('net_profit_recovery.manage')
  updateSettings(@Body() dto: { enabled?: boolean; delayHours?: number; maxAttempts?: number; quietHoursStart?: number; quietHoursEnd?: number }) {
    return this.recovery.updateSettings(dto);
  }
}
