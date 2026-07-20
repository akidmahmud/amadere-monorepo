import { Injectable, Logger } from '@nestjs/common';
import {
  AnalyticsEvent,
  AnalyticsProvider,
} from '../analytics-provider.interface';
import { AnalyticsSettingsService } from '../analytics-settings.service';

const ENDPOINT = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';

@Injectable()
export class TiktokEventsProvider implements AnalyticsProvider {
  readonly name = 'TIKTOK';
  private readonly logger = new Logger(TiktokEventsProvider.name);

  constructor(private readonly settings: AnalyticsSettingsService) {}

  async send(event: AnalyticsEvent): Promise<void> {
    const { enabled, pixelCode, accessToken } = await this.settings.getTiktokCredentials();
    if (!enabled || !pixelCode || !accessToken) return;

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
