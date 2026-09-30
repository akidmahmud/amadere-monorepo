import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { CurrentAdmin } from '../../../common/auth/current-admin.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { reportTitle } from '../../../common/excel/report-title';
import { DailyReportService } from './daily-report.service';
import {
  GenerateDailyReportDto,
  ListDailyReportsDto,
} from './dto/daily-report.dto';
import { buildDailyReportWorkbook } from './xlsx';

@ApiTags('admin/net-profit/daily-reports')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/daily-reports')
export class AdminDailyReportController {
  constructor(private readonly reports: DailyReportService) {}

  @Get()
  @RequirePermission('net_profit_daily_report.view')
  list(@Query() q: ListDailyReportsDto) {
    return this.reports.list(q);
  }

  // Declared before ':id' so Nest never parses "settings" as an id.
  @Get('settings')
  @RequirePermission('net_profit_daily_report.manage')
  getSettings() {
    return this.reports.getSettings();
  }

  @Put('settings')
  @RequirePermission('net_profit_daily_report.manage')
  putSettings(@Body() body: unknown) {
    return this.reports.putSettings(body);
  }

  @Post()
  @RequirePermission('net_profit_daily_report.manage')
  generate(
    @Body() dto: GenerateDailyReportDto,
    @CurrentAdmin() admin: { id: number },
  ) {
    return this.reports.generateManual(dto, admin.id);
  }

  @Get(':id')
  @RequirePermission('net_profit_daily_report.view')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.reports.get(id);
  }

  @Get(':id/export.xlsx')
  @RequirePermission('net_profit_daily_report.view')
  async export(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ): Promise<void> {
    const { name, kind, snapshot } = await this.reports.snapshotFor(id);
    const title = reportTitle(
      kind === 'AUTO' ? 'Daily Report' : name,
      snapshot.from,
      snapshot.to,
    );
    const buf = await buildDailyReportWorkbook(
      snapshot,
      title,
    ).xlsx.writeBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="daily-report-${snapshot.from}_${snapshot.to}.xlsx"`,
    );
    res.send(Buffer.from(buf));
  }

  @Delete(':id')
  @RequirePermission('net_profit_daily_report.manage')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.reports.remove(id);
  }
}
