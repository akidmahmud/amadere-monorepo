import { Body, Controller, Get, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { AnalyticsSettingsService } from './analytics-settings.service';
import {
  UpdateClaritySettingsDto,
  UpdateGa4SettingsDto,
  UpdateGoogleAdsSettingsDto,
  UpdateGtmSettingsDto,
  UpdateMetaSettingsDto,
  UpdateTiktokSettingsDto,
  UpdateUtmSettingsDto,
} from './dto/update-analytics-settings.dto';

@ApiTags('admin/analytics-settings')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/analytics/settings')
export class AdminAnalyticsSettingsController {
  constructor(private readonly settings: AnalyticsSettingsService) {}

  @Get('ga4')
  @RequirePermission('analytics.view')
  getGa4() {
    return this.settings.getGa4Config();
  }

  @Put('ga4')
  @RequirePermission('analytics.manage')
  updateGa4(@Body() dto: UpdateGa4SettingsDto) {
    return this.settings.updateGa4Config(dto);
  }

  @Get('gtm')
  @RequirePermission('analytics.view')
  getGtm() {
    return this.settings.getGtmConfig();
  }

  @Put('gtm')
  @RequirePermission('analytics.manage')
  updateGtm(@Body() dto: UpdateGtmSettingsDto) {
    return this.settings.updateGtmConfig(dto);
  }

  @Get('meta')
  @RequirePermission('analytics.view')
  getMeta() {
    return this.settings.getMetaConfig();
  }

  @Put('meta')
  @RequirePermission('analytics.manage')
  updateMeta(@Body() dto: UpdateMetaSettingsDto) {
    return this.settings.updateMetaConfig(dto);
  }

  @Get('google-ads')
  @RequirePermission('analytics.view')
  getGoogleAds() {
    return this.settings.getGoogleAdsConfig();
  }

  @Put('google-ads')
  @RequirePermission('analytics.manage')
  updateGoogleAds(@Body() dto: UpdateGoogleAdsSettingsDto) {
    return this.settings.updateGoogleAdsConfig(dto);
  }

  @Get('tiktok')
  @RequirePermission('analytics.view')
  getTiktok() {
    return this.settings.getTiktokConfig();
  }

  @Put('tiktok')
  @RequirePermission('analytics.manage')
  updateTiktok(@Body() dto: UpdateTiktokSettingsDto) {
    return this.settings.updateTiktokConfig(dto);
  }

  @Get('clarity')
  @RequirePermission('analytics.view')
  getClarity() {
    return this.settings.getClarityConfig();
  }

  @Put('clarity')
  @RequirePermission('analytics.manage')
  updateClarity(@Body() dto: UpdateClaritySettingsDto) {
    return this.settings.updateClarityConfig(dto);
  }

  @Get('utm')
  @RequirePermission('analytics.view')
  getUtm() {
    return this.settings.getUtmConfig();
  }

  @Put('utm')
  @RequirePermission('analytics.manage')
  updateUtm(@Body() dto: UpdateUtmSettingsDto) {
    return this.settings.updateUtmConfig(dto);
  }
}
