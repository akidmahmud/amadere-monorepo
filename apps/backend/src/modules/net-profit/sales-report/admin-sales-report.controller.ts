import { Controller, Get, Query, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { SalesReportService } from './sales-report.service';
import { SalesReportQueryDto } from './dto/sales-report-query.dto';
import { ProductPnlService, ProductPnlReport } from './product-pnl.service';
import { pnlToCsv, resolvePnlRange } from './product-pnl.csv';
import type { PnlPeriod } from './product-pnl.csv';

@ApiTags('admin/net-profit/reports')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/reports/sales')
export class AdminSalesReportController {
  constructor(
    private readonly report: SalesReportService,
    private readonly pnl: ProductPnlService,
  ) {}

  // The per-source, per-product P&L the business keeps by hand. `period`
  // covers the common cases (today / this week / this month); from+to
  // overrides it for a custom range, so one endpoint serves both.
  @Get('pnl')
  @RequirePermission('net_profit_reports.view')
  productPnl(
    @Query('period') period?: PnlPeriod,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<ProductPnlReport> {
    const range = resolvePnlRange(period, from, to);
    return this.pnl.report(range.from, range.to);
  }

  // Same columns, same order, same rows as the on-screen table — the export
  // must never be a different report from the one being looked at.
  @Get('pnl/export')
  @RequirePermission('net_profit_reports.view')
  async productPnlCsv(
    @Res() res: Response,
    @Query('period') period?: PnlPeriod,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<void> {
    const range = resolvePnlRange(period, from, to);
    const report = await this.pnl.report(range.from, range.to);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sales-pnl-${report.from}_${report.to}.csv"`,
    );
    // Excel opens UTF-8 CSV as mojibake without a BOM, and these rows carry
    // Bangla product names.
    res.send('﻿' + pnlToCsv(report));
  }

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
