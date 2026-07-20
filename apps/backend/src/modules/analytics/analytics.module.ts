import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsSettingsService } from './analytics-settings.service';
import { AnalyticsEventListener } from './analytics-event.listener';
import { AdminAnalyticsSettingsController } from './admin-analytics-settings.controller';
import { Ga4Provider } from './providers/ga4.provider';
import { MetaCapiProvider } from './providers/meta-capi.provider';
import { TiktokEventsProvider } from './providers/tiktok-events.provider';

@Module({
  controllers: [AnalyticsController, AdminAnalyticsSettingsController],
  providers: [
    AnalyticsService,
    AnalyticsSettingsService,
    AnalyticsEventListener,
    Ga4Provider,
    MetaCapiProvider,
    TiktokEventsProvider,
  ],
})
export class AnalyticsModule {}
