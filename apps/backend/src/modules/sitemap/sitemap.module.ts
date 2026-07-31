import { Module } from '@nestjs/common';
import { SitemapController } from './sitemap.controller';
import { AdminSitemapController } from './admin-sitemap.controller';
import { SitemapService } from './sitemap.service';
import { SitemapSettingsService } from './sitemap-settings.service';

@Module({
  controllers: [SitemapController, AdminSitemapController],
  providers: [SitemapService, SitemapSettingsService],
})
export class SitemapModule {}
