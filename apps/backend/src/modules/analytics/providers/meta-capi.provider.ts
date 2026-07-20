import { Injectable, Logger } from '@nestjs/common';
import {
  AnalyticsEvent,
  AnalyticsProvider,
} from '../analytics-provider.interface';
import { AnalyticsSettingsService } from '../analytics-settings.service';

const API_VERSION = 'v19.0';

@Injectable()
export class MetaCapiProvider implements AnalyticsProvider {
  readonly name = 'META_CAPI';
  private readonly logger = new Logger(MetaCapiProvider.name);

  constructor(private readonly settings: AnalyticsSettingsService) {}

  async send(event: AnalyticsEvent): Promise<void> {
    const { enabled, pixelId, accessToken } = await this.settings.getMetaCredentials();
    if (!enabled || !pixelId || !accessToken) return;

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
