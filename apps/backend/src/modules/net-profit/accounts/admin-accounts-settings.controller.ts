import { Body, Controller, Get, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { AccountsSettingsService } from './accounts-settings.service';
import { CodFeeSettings, PostingSettings, VatSettings } from './accounts.constants';

// Paths are unchanged from the controller this replaced, so the admin app's
// existing settings calls keep working while the rest of the module is rebuilt.
@ApiTags('admin/net-profit/accounts')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/accounts')
export class AdminAccountsSettingsController {
  constructor(private readonly settings: AccountsSettingsService) {}

  @Get('vat-settings')
  @RequirePermission('net_profit_accounts.view')
  getVatSettings() {
    return this.settings.getVatSettings();
  }

  @Put('vat-settings')
  @RequirePermission('net_profit_accounts.manage')
  updateVatSettings(@Body() dto: Partial<VatSettings>) {
    return this.settings.updateVatSettings(dto);
  }

  @Get('cod-fee-settings')
  @RequirePermission('net_profit_accounts.view')
  getCodFeeSettings() {
    return this.settings.getCodFeeSettings();
  }

  @Put('cod-fee-settings')
  @RequirePermission('net_profit_accounts.manage')
  updateCodFeeSettings(@Body() dto: Partial<CodFeeSettings>) {
    return this.settings.updateCodFeeSettings(dto);
  }

  // Which cash account prepaid sales and refunds post to. Until this is set,
  // SalesPostingService posts nothing rather than guessing an account, and
  // the Accounts overview raises an alert saying so.
  @Get('posting-settings')
  @RequirePermission('net_profit_accounts.view')
  getPostingSettings() {
    return this.settings.getPostingSettings();
  }

  @Put('posting-settings')
  @RequirePermission('net_profit_accounts.manage')
  updatePostingSettings(@Body() dto: Partial<PostingSettings>) {
    return this.settings.updatePostingSettings(dto);
  }
}
