import { Body, Controller, Get, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import { UpdateWhatsappSettingsDto } from './dto/update-whatsapp-settings.dto';

@ApiTags('admin/whatsapp')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/whatsapp/settings')
export class AdminWhatsappController {
  constructor(private readonly settings: WhatsappSettingsService) {}

  @Get()
  @RequirePermission('whatsapp.view')
  get() {
    return this.settings.getSettings();
  }

  @Put()
  @RequirePermission('whatsapp.manage')
  update(@Body() dto: UpdateWhatsappSettingsDto) {
    return this.settings.updateSettings(dto);
  }
}
