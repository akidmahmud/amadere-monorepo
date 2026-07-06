import { Module } from '@nestjs/common';
import { AdminSettingsController } from './admin-settings.controller';
import { SiteInfoController } from './site-info.controller';
import { SettingsService } from './settings.service';

@Module({
  controllers: [AdminSettingsController, SiteInfoController],
  providers: [SettingsService],
})
export class SettingsModule {}
