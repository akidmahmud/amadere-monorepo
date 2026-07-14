import { Controller, Get, Query, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { SalesReportService } from './sales-report.service';
import { SalesReportQueryDto } from './dto/sales-report-query.dto';

@ApiTags('admin/net-profit/reports')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/reports/sales')
export class AdminSalesReportController {
  constructor(private readonly report: SalesReportService) {}

  @Get()
  @RequirePermission('net_profit_reports.view')
  sales(@Query() query: SalesReportQueryDto) {
    return this.report.sales(
      query.groupBy ?? 'day',
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(query.to) : undefined,
    );
  }

  @Get('top-products')
  @RequirePermission('net_profit_reports.view')
  topProducts(@Query() query: SalesReportQueryDto, @Query('limit') limit?: string) {
    return this.report.topProducts(
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(query.to) : undefined,
      limit ? Number(limit) : undefined,
    );
  }

  @Get('export')
  @RequirePermission('net_profit_reports.view')
  async export(@Query() query: SalesReportQueryDto, @Res() res: Response) {
    const csv = await this.report.exportCsv(
      query.groupBy ?? 'day',
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(query.to) : undefined,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sales-report.csv"');
    res.send(csv);
  }

  @Get('export.html')
  @RequirePermission('net_profit_reports.view')
  async exportHtml(@Query() query: SalesReportQueryDto, @Res() res: Response) {
    const html = await this.report.exportHtml(
      query.groupBy ?? 'day',
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(query.to) : undefined,
    );
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sales-report.html"');
    res.send(html);
  }
}
