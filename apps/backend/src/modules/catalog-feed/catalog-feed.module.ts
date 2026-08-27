import { Module } from '@nestjs/common';
import { CatalogFeedService } from './catalog-feed.service';
import { CatalogFeedPublicController } from './catalog-feed.public.controller';
import { AdminCatalogFeedController } from './admin-catalog-feed.controller';
import { CatalogFeedScheduler } from './catalog-feed.scheduler';

@Module({
  controllers: [CatalogFeedPublicController, AdminCatalogFeedController],
  providers: [CatalogFeedService, CatalogFeedScheduler],
  // Exported so ProductsService can drop the cache the moment a product is
  // saved, instead of the feed serving stale prices for up to half an hour.
  exports: [CatalogFeedService],
})
export class CatalogFeedModule {}
