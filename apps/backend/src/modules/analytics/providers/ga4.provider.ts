import { Injectable, Logger } from '@nestjs/common';
import {
  AnalyticsEvent,
  AnalyticsProvider,
} from '../analytics-provider.interface';
import { AnalyticsSettingsService } from '../analytics-settings.service';

const ENDPOINT = 'https://www.google-analytics.com/mp/collect';

@Injectable()
export class Ga4Provider implements AnalyticsProvider {
  readonly name = 'GA4';
  private readonly logger = new Logger(Ga4Provider.name);

  constructor(private readonly settings: AnalyticsSettingsService) {}

  async send(event: AnalyticsEvent): Promise<void> {
    const { enabled, measurementId, apiSecret } = await this.settings.getGa4Credentials();
    if (!enabled || !measurementId || !apiSecret) return;

    try {
      const res = await fetch(
        `${ENDPOINT}?measurement_id=${measurementId}&api_secret=${apiSecret}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: event.clientId ?? 'anonymous',
            events: [{ name: event.name, params: event.params }],
          }),
        },
      );
      if (!res.ok) {
        this.logger.warn(`GA4 event forward failed: HTTP ${res.status}`);
      }
    } catch (error) {
      this.logger.warn(`GA4 event forward failed: ${(error as Error).message}`);
    }
  }
}
