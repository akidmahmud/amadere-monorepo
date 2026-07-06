import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { SettingsService } from './settings.service';
import { UpsertSettingDto } from './dto/upsert-setting.dto';
import { SettingDto } from './settings.mapper';

@ApiTags('admin/settings')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @RequirePermission('setting.view')
  @ApiOkResponse({ type: SettingDto, isArray: true })
  list(): Promise<SettingDto[]> {
    return this.settings.list();
  }

  @Get(':key')
  @RequirePermission('setting.view')
  @ApiOkResponse({ type: SettingDto })
  get(@Param('key') key: string): Promise<SettingDto> {
    return this.settings.get(key);
  }

  @Put(':key')
  @RequirePermission('setting.update')
  @ApiOkResponse({ type: SettingDto })
  upsert(
    @Param('key') key: string,
    @Body() dto: UpsertSettingDto,
  ): Promise<SettingDto> {
    return this.settings.upsert(key, dto.value);
  }
}
