import { Body, Controller, Get, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { ShippingLabelSettingsService, DEFAULT_SHIPPING_LABEL_TEMPLATE } from './shipping-label-settings.service';
import { UpdateShippingLabelSettingsDto } from './dto/update-shipping-label-settings.dto';

@ApiTags('admin/shipping-label-settings')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/shipping-label-settings')
export class AdminShippingLabelSettingsController {
  constructor(private readonly settings: ShippingLabelSettingsService) {}

  @Get()
  @RequirePermission('shipping_label_settings.view')
  async get() {
    const settings = await this.settings.getSettings();
    return { ...settings, defaultTemplate: DEFAULT_SHIPPING_LABEL_TEMPLATE };
  }

  @Put()
  @RequirePermission('shipping_label_settings.manage')
  update(@Body() dto: UpdateShippingLabelSettingsDto) {
    return this.settings.updateSettings(dto);
  }
}
