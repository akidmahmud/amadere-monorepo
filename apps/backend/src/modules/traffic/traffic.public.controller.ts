import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { TrafficService } from './traffic.service';

class CollectPageViewDto {
  @ApiProperty({ description: 'Random id the browser keeps in localStorage' })
  @IsString()
  @MaxLength(64)
  visitorId!: string;

  @ApiProperty({ description: 'Random id the browser keeps in sessionStorage' })
  @IsString()
  @MaxLength(64)
  sessionId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(512)
  path!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) referrer?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) utmSource?: string;
}

/**
 * The storefront beacon's endpoint.
 *
 * Same-origin on purpose. The GA4/Meta tags in Settings > Analytics report to
 * Google and Meta, so their numbers are both invisible to us and heavily
 * ad-blocked; this one is our own origin, so it survives blockers and needs no
 * third-party account to read back.
 *
 * The user agent and the Cloudflare country header are read HERE and used to
 * derive a device class and a country code — neither the UA string nor the IP
 * is ever stored.
 */
@ApiTags('traffic')
@Controller('traffic')
export class TrafficPublicController {
  constructor(private readonly traffic: TrafficService) {}

  // Generous next to the 120/min global default: a real person browsing fast
  // still fires one of these per page, and throttling a page view is not
  // worth a 429 on a shopper's screen.
  @Post('collect')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  // 204: the browser sends this with sendBeacon/keepalive and never reads the
  // response, so there is nothing to return.
  @HttpCode(204)
  async collect(
    @Body() dto: CollectPageViewDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('cf-ipcountry') country?: string,
    @Headers('host') host?: string,
  ): Promise<void> {
    await this.traffic.record({
      visitorId: dto.visitorId,
      sessionId: dto.sessionId,
      path: dto.path,
      referrer: dto.referrer,
      utmSource: dto.utmSource,
      userAgent,
      // Set by Cloudflare, which the site already sits behind. Absent in
      // local development, and then simply not recorded.
      country: country && country !== 'XX' ? country : undefined,
      selfHost: host?.replace(/^www\./, '').split(':')[0],
    });
  }
}
