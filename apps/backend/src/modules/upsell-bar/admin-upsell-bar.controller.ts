import { Body, Controller, Get, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { UpsellBarSettings, UpsellBarSettingsService } from './upsell-bar-settings.service';
import { UpsellStagesService } from './upsell-stages.service';
import { UpdateUpsellBarSettingsDto } from './dto/update-upsell-bar-settings.dto';
import { UpdateUpsellStagesDto } from './dto/update-upsell-stages.dto';

@ApiTags('admin/upsell-bar')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/upsell-bar')
export class AdminUpsellBarController {
  constructor(
    private readonly settings: UpsellBarSettingsService,
    private readonly stages: UpsellStagesService,
  ) {}

  @Get('settings')
  @RequirePermission('upsell_bar.view')
  getSettings(): Promise<UpsellBarSettings> {
    return this.settings.getSettings();
  }

  @Put('settings')
  @RequirePermission('upsell_bar.manage')
  updateSettings(@Body() dto: UpdateUpsellBarSettingsDto): Promise<UpsellBarSettings> {
    return this.settings.updateSettings(dto);
  }

  @Get('stages')
  @RequirePermission('upsell_bar.view')
  listStages() {
    return this.stages.list();
  }

  @Put('stages')
  @RequirePermission('upsell_bar.manage')
  replaceStages(@Body() dto: UpdateUpsellStagesDto) {
    return this.stages.replace(dto.stages);
  }
}
