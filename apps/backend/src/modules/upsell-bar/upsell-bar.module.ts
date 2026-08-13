import { Module } from '@nestjs/common';
import { AdminUpsellBarController } from './admin-upsell-bar.controller';
import { UpsellBarSettingsService } from './upsell-bar-settings.service';
import { UpsellStagesService } from './upsell-stages.service';

@Module({
  controllers: [AdminUpsellBarController],
  providers: [UpsellBarSettingsService, UpsellStagesService],
  exports: [UpsellBarSettingsService],
})
export class UpsellBarModule {}
