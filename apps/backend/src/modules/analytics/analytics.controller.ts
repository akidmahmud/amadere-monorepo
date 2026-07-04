import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { TrackEventDto } from './dto/track-event.dto';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  // Public and unauthenticated on purpose — this is what the frontend's
  // client-side tracking calls hit directly (page views, product views,
  // add-to-cart clicks), the same way a GA/GTM snippet would.
  @Post('events')
  @HttpCode(202)
  async track(@Body() dto: TrackEventDto) {
    await this.analytics.track({
      name: dto.name,
      params: dto.params ?? {},
      clientId: dto.clientId,
    });
    return { accepted: true };
  }
}
