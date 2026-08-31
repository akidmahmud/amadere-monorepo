import { Body, Controller, Get, Post, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { BkashSettingsService } from './bkash-settings.service';
import { BkashPaymentProvider } from './bkash-payment.provider';
import { UpdateBkashSettingsDto } from './dto/update-bkash-settings.dto';

// Admin > Settings > Payment Methods. Reuses the same permission the existing
// payment-method configuration screen uses rather than inventing a new one —
// whoever configures how customers pay configures this too.
@ApiTags('admin/payment-settings')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/payment-settings')
export class AdminBkashSettingsController {
  constructor(
    private readonly settings: BkashSettingsService,
    private readonly provider: BkashPaymentProvider,
  ) {}

  @Get('bkash')
  @RequirePermission('net_profit_settings.manage')
  get() {
    return this.settings.getConfig();
  }

  @Put('bkash')
  @RequirePermission('net_profit_settings.manage')
  update(@Body() dto: UpdateBkashSettingsDto) {
    return this.settings.update(dto);
  }

  // Asks bKash to authenticate the stored credentials, and reports back
  // whatever bKash says. POST rather than GET because it makes a live call
  // out to a third party.
  @Post('bkash/test')
  @RequirePermission('net_profit_settings.manage')
  test() {
    return this.provider.testCredentials();
  }
}
