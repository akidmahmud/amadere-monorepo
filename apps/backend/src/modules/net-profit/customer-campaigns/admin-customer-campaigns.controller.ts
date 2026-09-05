import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { CustomerCampaignsService } from './customer-campaigns.service';
import {
  UpdateCustomerCampaignSettingsDto,
  UpsertCustomerCampaignTemplateDto,
} from './dto/customer-campaigns.dto';

// Reuses net_profit_recovery.manage, the same permission the cart-campaign
// engine sits behind — both are automated outbound messaging to shoppers,
// and splitting them would be a distinction nobody asked for.
@ApiTags('admin/net-profit/customer-campaigns')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/customer-campaigns')
export class AdminCustomerCampaignsController {
  constructor(private readonly campaigns: CustomerCampaignsService) {}

  @Get('settings')
  @RequirePermission('net_profit_recovery.manage')
  getSettings() {
    return this.campaigns.getSettings();
  }

  @Put('settings')
  @RequirePermission('net_profit_recovery.manage')
  updateSettings(@Body() dto: UpdateCustomerCampaignSettingsDto) {
    return this.campaigns.updateSettings(dto);
  }

  @Get('templates')
  @RequirePermission('net_profit_recovery.manage')
  listTemplates() {
    return this.campaigns.listTemplates();
  }

  @Post('templates')
  @RequirePermission('net_profit_recovery.manage')
  createTemplate(@Body() dto: UpsertCustomerCampaignTemplateDto) {
    return this.campaigns.createTemplate(dto);
  }

  @Patch('templates/:id')
  @RequirePermission('net_profit_recovery.manage')
  updateTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<UpsertCustomerCampaignTemplateDto>,
  ) {
    return this.campaigns.updateTemplate(id, dto as Record<string, unknown>);
  }

  @Delete('templates/:id')
  @RequirePermission('net_profit_recovery.manage')
  deleteTemplate(@Param('id', ParseIntPipe) id: number) {
    return this.campaigns.deleteTemplate(id);
  }

  @Get('queue')
  @RequirePermission('net_profit_recovery.manage')
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'SENT', 'FAILED', 'SKIPPED'] })
  listQueue(@Query('status') status?: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED') {
    return this.campaigns.listQueue(status);
  }

  @Post('queue/:id/cancel')
  @RequirePermission('net_profit_recovery.manage')
  cancelQueueItem(@Param('id', ParseIntPipe) id: number) {
    return this.campaigns.cancelQueueItem(id);
  }

  // Send one step now, ignoring its schedule. The only way to prove a
  // template actually delivers before switching the engine on.
  @Post('queue/:id/send-now')
  @RequirePermission('net_profit_recovery.manage')
  sendNow(@Param('id', ParseIntPipe) id: number) {
    return this.campaigns.sendQueueItem(id);
  }

  // Queue the sequence for an existing customer — for testing against your
  // own record, and for enrolling people who were added before this existed.
  @Post('enqueue/:customerId')
  @RequirePermission('net_profit_recovery.manage')
  enqueue(@Param('customerId', ParseIntPipe) customerId: number) {
    return this.campaigns.enqueueForCustomer(customerId);
  }
}
