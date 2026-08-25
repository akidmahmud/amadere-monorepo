import { Body, Controller, Get, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { InvoiceTemplateSettingsService, DEFAULT_INVOICE_TEMPLATE } from './invoice-template-settings.service';
import { UpdateInvoiceTemplateSettingsDto } from './dto/update-invoice-template-settings.dto';

@ApiTags('admin/invoice-template-settings')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/invoice-template-settings')
export class AdminInvoiceTemplateSettingsController {
  constructor(private readonly settings: InvoiceTemplateSettingsService) {}

  @Get()
  // Same reasoning as admin-invoice-settings.controller.ts: InvoiceDocument
  // reads this on every print, and `invoice_template_settings.view` is absent
  // from PERMISSION_CATALOG, so only a super admin (who bypasses the guard)
  // could ever load it. Anyone who may view an order may print its invoice.
  @RequirePermission('order.view')
  async get() {
    const settings = await this.settings.getSettings();
    return { ...settings, defaultTemplate: DEFAULT_INVOICE_TEMPLATE };
  }

  @Put()
  @RequirePermission('invoice_template_settings.manage')
  update(@Body() dto: UpdateInvoiceTemplateSettingsDto) {
    return this.settings.updateSettings(dto);
  }
}
