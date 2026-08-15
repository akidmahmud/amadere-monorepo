import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsSettingsService } from './analytics-settings.service';
import { AdminAnalyticsSettingsController } from './admin-analytics-settings.controller';

@Module({
  controllers: [AnalyticsController, AdminAnalyticsSettingsController],
  providers: [AnalyticsSettingsService],
})
export class AnalyticsModule {}
