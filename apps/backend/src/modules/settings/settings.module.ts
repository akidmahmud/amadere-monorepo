import { Module } from '@nestjs/common';
import { NetProfitSettingsModule } from '../net-profit/settings/net-profit-settings.module';
import { AdminSettingsController } from './admin-settings.controller';
import { SiteInfoController } from './site-info.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [NetProfitSettingsModule],
  controllers: [AdminSettingsController, SiteInfoController],
  providers: [SettingsService],
  // Exported so the OTP email senders can read the store logo for the
  // branded template (auth notifier + checkout COD OTP).
  exports: [SettingsService],
})
export class SettingsModule {}
