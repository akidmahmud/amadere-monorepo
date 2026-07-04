import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsEventListener } from './analytics-event.listener';
import { Ga4Provider } from './providers/ga4.provider';
import { MetaCapiProvider } from './providers/meta-capi.provider';
import { TiktokEventsProvider } from './providers/tiktok-events.provider';

@Module({
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    AnalyticsEventListener,
    Ga4Provider,
    MetaCapiProvider,
    TiktokEventsProvider,
  ],
})
export class AnalyticsModule {}
