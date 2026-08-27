import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CatalogFeedService } from './catalog-feed.service';

/**
 * The 30-minute fallback from the brief.
 *
 * The real freshness mechanism is the cache drop on every product write —
 * this exists for the changes that never pass through ProductsService (a
 * direct SQL fix, a restore from backup, a scheduled price change landing
 * some other way), so the feed can never be more than half an hour stale
 * whatever happened.
 */
@Injectable()
export class CatalogFeedScheduler {
  private readonly logger = new Logger(CatalogFeedScheduler.name);

  constructor(private readonly feed: CatalogFeedService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async regenerate(): Promise<void> {
    try {
      const { items } = await this.feed.rebuild();
      this.logger.log(`Scheduled catalog feed rebuild: ${items.length} products`);
    } catch (err) {
      // Swallowed deliberately: a failed rebuild must not kill the scheduler,
      // and the previous feed is still being served from the CDN cache.
      this.logger.error(
        `Scheduled catalog feed rebuild failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
