import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AnalyticsEvent,
  AnalyticsProvider,
} from '../analytics-provider.interface';

const ENDPOINT = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';

@Injectable()
export class TiktokEventsProvider implements AnalyticsProvider {
  readonly name = 'TIKTOK';
  private readonly logger = new Logger(TiktokEventsProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(event: AnalyticsEvent): Promise<void> {
    const pixelCode = this.config.get<string>('TIKTOK_PIXEL_CODE');
    const accessToken = this.config.get<string>('TIKTOK_ACCESS_TOKEN');
    if (!pixelCode || !accessToken) return;

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Access-Token': accessToken,
        },
        body: JSON.stringify({
          pixel_code: pixelCode,
          event: event.name,
          timestamp: new Date().toISOString(),
          context: event.clientId
            ? { user: { external_id: event.clientId } }
            : undefined,
          properties: event.params,
        }),
      });
      if (!res.ok) {
        this.logger.warn(`TikTok event forward failed: HTTP ${res.status}`);
      }
    } catch (error) {
      this.logger.warn(
        `TikTok event forward failed: ${(error as Error).message}`,
      );
    }
  }
}
