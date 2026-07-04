import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AnalyticsEvent,
  AnalyticsProvider,
} from '../analytics-provider.interface';

const ENDPOINT = 'https://www.google-analytics.com/mp/collect';

@Injectable()
export class Ga4Provider implements AnalyticsProvider {
  readonly name = 'GA4';
  private readonly logger = new Logger(Ga4Provider.name);

  constructor(private readonly config: ConfigService) {}

  async send(event: AnalyticsEvent): Promise<void> {
    const measurementId = this.config.get<string>('GA4_MEASUREMENT_ID');
    const apiSecret = this.config.get<string>('GA4_API_SECRET');
    if (!measurementId || !apiSecret) return;

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
