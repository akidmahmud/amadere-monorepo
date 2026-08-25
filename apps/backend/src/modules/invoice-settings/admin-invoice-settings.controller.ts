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

  // Gated on `order.view`, not `invoice_settings.view`.
  //
  // Reading these settings is how an invoice gets its company name, logo,
  // address and footer — InvoiceDocument calls this on every print. But
  // `invoice_settings.view` is not in PERMISSION_CATALOG, so it cannot be
  // granted to any role: the only account that ever passed was a super admin,
  // who skips the guard entirely (permission.guard.ts). Every other admin got
  // a 403, the hook returned undefined, and the invoice silently fell back to
  // the bare "Amader" default with no logo and no company details — two
  // different documents for the same order depending on who pressed print.
  //
  // Whoever may view an order may print its invoice, so that is the permission
  // this read belongs to. Nothing here is sensitive: it is the branding
  // printed on the document handed to the customer. Writing stays restricted
  // below.
  @Get()
  @RequirePermission('order.view')
  get() {
    return this.settings.getSettings();
  }

  @Put()
  @RequirePermission('invoice_settings.manage')
  update(@Body() dto: UpdateInvoiceSettingsDto) {
    return this.settings.updateSettings(dto);
  }
}
