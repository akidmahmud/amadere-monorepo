import { Injectable } from '@nestjs/common';
import {
  AnalyticsEvent,
  AnalyticsProvider,
} from './analytics-provider.interface';
import { Ga4Provider } from './providers/ga4.provider';
import { MetaCapiProvider } from './providers/meta-capi.provider';
import { TiktokEventsProvider } from './providers/tiktok-events.provider';

@Injectable()
export class AnalyticsService {
  private readonly providers: AnalyticsProvider[];

  constructor(
    ga4: Ga4Provider,
    metaCapi: MetaCapiProvider,
    tiktok: TiktokEventsProvider,
  ) {
    this.providers = [ga4, metaCapi, tiktok];
  }

  // Best-effort fan-out — one provider's failure (or simply being
  // unconfigured) never affects another's, and never surfaces to the caller.
  async track(event: AnalyticsEvent): Promise<void> {
    await Promise.allSettled(this.providers.map((p) => p.send(event)));
  }
}
