import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { SmsService, SmsSettings } from './sms.service';
import { UpdateSmsTemplateDto } from './dto/update-sms-template.dto';
import { TestSendSmsDto } from './dto/test-send-sms.dto';

@ApiTags('admin/net-profit/sms')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/sms')
export class AdminSmsController {
  constructor(private readonly sms: SmsService) {}

  @Get('templates')
  @RequirePermission('net_profit_sms.view')
  templates() {
    return this.sms.listTemplates();
  }

  @Put('templates/:key')
  @RequirePermission('net_profit_sms.manage')
  updateTemplate(@Param('key') key: string, @Body() dto: UpdateSmsTemplateDto) {
    return this.sms.updateTemplate(key, dto);
  }

  @Get('logs')
  @RequirePermission('net_profit_sms.view')
  logs(@Query() { page, pageSize }: PaginationQueryDto) {
    return this.sms.listLogs(page ?? 1, pageSize ?? 20);
  }

  @Post('test')
  @RequirePermission('net_profit_sms.manage')
  test(@Body() dto: TestSendSmsDto) {
    return this.sms.send(dto.to, dto.body);
  }

  @Get('settings')
  @RequirePermission('net_profit_sms.view')
  getSettings() {
    return this.sms.getSettings();
  }

  @Put('settings')
  @RequirePermission('net_profit_sms.manage')
  updateSettings(@Body() dto: Partial<SmsSettings> & { apiKey?: string }) {
    return this.sms.updateSettings(dto);
  }

  @Delete('settings/api-key')
  @RequirePermission('net_profit_sms.manage')
  clearApiKey() {
    return this.sms.clearApiKey();
  }

  @Get('balance')
  @RequirePermission('net_profit_sms.view')
  async balance() {
    return { balance: await this.sms.getBalance() };
  }

  @Post('bulk')
  @RequirePermission('net_profit_sms.manage')
  bulk(@Body() dto: { body: string; segment: 'all' | 'has_ordered' }) {
    return this.sms.bulkSend(dto.body, dto.segment);
  }
}
