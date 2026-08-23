import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../../common/auth/permission.guard';
import { RequirePermission } from '../../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../../common/audit-log/audit-log.interceptor';
import { VatService } from './vat.service';

@ApiTags('admin/net-profit/accounts')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/accounts/vat')
export class AdminVatController {
  constructor(private readonly vat: VatService) {}

  @Get('return')
  @RequirePermission('net_profit_accounts.view')
  vatReturn(@Query('from') from?: string, @Query('to') to?: string) {
    return this.vat.vatReturn(from, to);
  }

  @Get('at-risk')
  @RequirePermission('net_profit_accounts.view')
  atRisk(@Query('from') from?: string, @Query('to') to?: string) {
    return this.vat.atRisk(from, to);
  }
}
