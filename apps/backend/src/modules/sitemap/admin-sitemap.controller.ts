import { Body, Controller, Get, Post, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { SitemapService } from './sitemap.service';
import { SitemapSettingsService } from './sitemap-settings.service';
import { UpdateSitemapSettingsDto } from './dto/update-sitemap-settings.dto';

@ApiTags('admin/sitemap')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/sitemap')
export class AdminSitemapController {
  constructor(
    private readonly sitemap: SitemapService,
    private readonly settings: SitemapSettingsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @RequirePermission('sitemap.view')
  async get() {
    const [settings, urlCount] = await Promise.all([this.settings.getSettings(), this.sitemap.getUrlCount()]);
    const baseUrl = this.config.get<string>('STOREFRONT_BASE_URL') ?? '';
    return {
      ...settings,
      urlCount,
      sitemapUrl: `${baseUrl}/sitemap.xml`,
      robotsUrl: `${baseUrl}/robots.txt`,
      indexNowFileUrl: settings.indexNowKey ? `${baseUrl}/${settings.indexNowKey}.txt` : null,
    };
  }

  @Put()
  @RequirePermission('sitemap.manage')
  update(@Body() dto: UpdateSitemapSettingsDto) {
    return this.settings.updateSettings(dto);
  }

  @Post('indexnow/generate-key')
  @RequirePermission('sitemap.manage')
  generateKey() {
    return this.settings.generateIndexNowKey();
  }

  @Post('indexnow/ping')
  @RequirePermission('sitemap.manage')
  ping() {
    return this.sitemap.pingIndexNow();
  }
}
