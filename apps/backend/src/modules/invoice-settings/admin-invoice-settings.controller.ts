import { Body, Controller, Get, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { InvoiceSettingsService } from './invoice-settings.service';
import { UpdateInvoiceSettingsDto } from './dto/update-invoice-settings.dto';

@ApiTags('admin/invoice-settings')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/invoice-settings')
export class AdminInvoiceSettingsController {
  constructor(private readonly settings: InvoiceSettingsService) {}

  @Get()
  @RequirePermission('invoice_settings.view')
  get() {
    return this.settings.getSettings();
  }

  @Put()
  @RequirePermission('invoice_settings.manage')
  update(@Body() dto: UpdateInvoiceSettingsDto) {
    return this.settings.updateSettings(dto);
  }
}
