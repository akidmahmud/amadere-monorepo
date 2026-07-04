import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AnalyticsEvent,
  AnalyticsProvider,
} from '../analytics-provider.interface';

const API_VERSION = 'v19.0';

@Injectable()
export class MetaCapiProvider implements AnalyticsProvider {
  readonly name = 'META_CAPI';
  private readonly logger = new Logger(MetaCapiProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(event: AnalyticsEvent): Promise<void> {
    const pixelId = this.config.get<string>('META_PIXEL_ID');
    const accessToken = this.config.get<string>('META_ACCESS_TOKEN');
    if (!pixelId || !accessToken) return;

    try {
      const res = await fetch(
        `https://graph.facebook.com/${API_VERSION}/${pixelId}/events?access_token=${accessToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: [
              {
                // Caller is expected to pass Meta's own event vocabulary
                // (e.g. "Purchase", "CompleteRegistration") in event.name —
                // this provider doesn't translate GA4-style names for them.
                event_name: event.name,
                event_time: Math.floor(Date.now() / 1000),
                action_source: 'website',
                user_data: event.userId
                  ? { external_id: event.userId }
                  : undefined,
                custom_data: event.params,
              },
            ],
          }),
        },
      );
      if (!res.ok) {
        this.logger.warn(`Meta CAPI event forward failed: HTTP ${res.status}`);
      }
    } catch (error) {
      this.logger.warn(
        `Meta CAPI event forward failed: ${(error as Error).message}`,
      );
    }
  }
}
