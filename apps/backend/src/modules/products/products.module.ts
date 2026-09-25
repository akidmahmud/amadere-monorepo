import { StoresModule } from '../stores/stores.module';
import { ProductCostHistoryModule } from '../product-cost-history/product-cost-history.module';
import { Module } from '@nestjs/common';
import { CatalogFeedModule } from '../catalog-feed/catalog-feed.module';
import { SeoModule } from '../seo/seo.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { AdminProductsController } from './admin-products.controller';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [SeoModule, ReviewsModule, CatalogFeedModule, ProductCostHistoryModule, StoresModule],
  controllers: [ProductsController, AdminProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
