import { Controller, Get, Param, Query, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AdminJwtGuard } from '../../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../../common/auth/permission.guard';
import { RequirePermission } from '../../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../../common/audit-log/audit-log.interceptor';
import { ReportsService } from './reports.service';
import type { ExportKind } from './reports.service';

@ApiTags('admin/net-profit/accounts')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/accounts/reports')
export class AdminReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('overview')
  @RequirePermission('net_profit_accounts.view')
  overview(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.overview(from, to);
  }

  @Get('cash-flow')
  @RequirePermission('net_profit_accounts.view')
  cashFlow(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.cashFlowByAccount(from, to);
  }

  // The whole query string is forwarded to the underlying list, so the file
  // always matches whatever filters produced the screen it was launched from.
  @Get('export/:kind')
  @RequirePermission('net_profit_accounts.view')
  async export(
    @Param('kind') kind: ExportKind,
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const buffer = await this.reports.exportExcel(kind, query);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${kind}.xlsx"`);
    res.send(buffer);
  }
}
