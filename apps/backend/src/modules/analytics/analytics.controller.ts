import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsSettingsService, PublicAnalyticsConfig } from './analytics-settings.service';
import { TrackEventDto } from './dto/track-event.dto';

class AnalyticsAckDto {
  accepted!: boolean;
}

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly settings: AnalyticsSettingsService,
  ) {}

  // Public and unauthenticated on purpose — this is what the frontend's
  // client-side tracking calls hit directly (page views, product views,
  // add-to-cart clicks), the same way a GA/GTM snippet would.
  @Post('events')
  @HttpCode(202)
  @ApiOkResponse({ type: AnalyticsAckDto })
  async track(@Body() dto: TrackEventDto): Promise<AnalyticsAckDto> {
    await this.analytics.track({
      name: dto.name,
      params: dto.params ?? {},
      clientId: dto.clientId,
    });
    return { accepted: true };
  }

  // Client-safe subset of the admin-configured tracking IDs (never secrets)
  // — the storefront's script loader (AnalyticsScripts) reads this to decide
  // which pixels/tags to inject, so IDs live in one admin-editable place
  // instead of being hardcoded into the frontend build.
  @Get('config')
  getConfig(): Promise<PublicAnalyticsConfig> {
    return this.settings.getPublicConfig();
  }
}
