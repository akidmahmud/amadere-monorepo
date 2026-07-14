import { Body, Controller, Get, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { OtpSecurityService, OtpSecuritySettings } from './otp-security.service';

@ApiTags('admin/net-profit/otp-security')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/otp-security')
export class AdminOtpSecurityController {
  constructor(private readonly otpSecurity: OtpSecurityService) {}

  @Get('settings')
  @RequirePermission('net_profit_settings.manage')
  getSettings() {
    return this.otpSecurity.getSettings();
  }

  @Put('settings')
  @RequirePermission('net_profit_settings.manage')
  updateSettings(@Body() dto: Partial<OtpSecuritySettings>) {
    return this.otpSecurity.updateSettings(dto);
  }
}
