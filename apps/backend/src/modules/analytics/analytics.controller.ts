import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { AnalyticsSettingsService, PublicAnalyticsConfig } from './analytics-settings.service';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly settings: AnalyticsSettingsService) {}

  // Client-safe subset of the admin-configured tracking IDs (never secrets)
  // — the storefront's script loader (AnalyticsScripts) reads this to decide
  // which pixels/tags to inject, so IDs live in one admin-editable place
  // instead of being hardcoded into the frontend build.
  // Fetched server-side on every single page load (root layout) — see
  // SiteInfoController's comment for why this is exempt from the global
  // per-IP throttle.
  @SkipThrottle()
  @Get('config')
  getConfig(): Promise<PublicAnalyticsConfig> {
    return this.settings.getPublicConfig();
  }
}
