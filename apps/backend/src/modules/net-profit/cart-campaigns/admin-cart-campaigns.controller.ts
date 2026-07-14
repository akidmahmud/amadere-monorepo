import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { CartCampaignsService } from './cart-campaigns.service';
import { UpsertCampaignTemplateDto } from './dto/upsert-campaign-template.dto';

@ApiTags('admin/net-profit/cart-campaigns')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/cart-campaigns')
export class AdminCartCampaignsController {
  constructor(private readonly campaigns: CartCampaignsService) {}

  @Get('templates')
  @RequirePermission('net_profit_recovery.manage')
  listTemplates() {
    return this.campaigns.listTemplates();
  }

  @Post('templates')
  @RequirePermission('net_profit_recovery.manage')
  createTemplate(@Body() dto: UpsertCampaignTemplateDto) {
    return this.campaigns.createTemplate(dto);
  }

  @Put('templates/:id')
  @RequirePermission('net_profit_recovery.manage')
  updateTemplate(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<UpsertCampaignTemplateDto>) {
    return this.campaigns.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  @RequirePermission('net_profit_recovery.manage')
  deleteTemplate(@Param('id', ParseIntPipe) id: number) {
    return this.campaigns.deleteTemplate(id);
  }

  @Get('queue')
  @RequirePermission('net_profit_recovery.manage')
  queue(@Query('status') status?: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED') {
    return this.campaigns.listQueue(status);
  }

  @Post('queue/:id/retry')
  @RequirePermission('net_profit_recovery.manage')
  retry(@Param('id', ParseIntPipe) id: number) {
    return this.campaigns.retryQueueItem(id);
  }

  @Post('queue/:id/cancel')
  @RequirePermission('net_profit_recovery.manage')
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.campaigns.cancelQueueItem(id);
  }

  @Get('logs')
  @RequirePermission('net_profit_recovery.manage')
  logs() {
    return this.campaigns.listLogs();
  }

  @Get('settings')
  @RequirePermission('net_profit_recovery.manage')
  getSettings() {
    return this.campaigns.getSettings();
  }

  @Put('settings')
  @RequirePermission('net_profit_recovery.manage')
  updateSettings(@Body() dto: { enabled?: boolean; maxAttempts?: number; quietHoursStart?: number; quietHoursEnd?: number }) {
    return this.campaigns.updateSettings(dto);
  }
}
