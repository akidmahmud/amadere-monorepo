import { Module } from '@nestjs/common';
import { AdminProductBundlesController } from './admin-product-bundles.controller';
import { ProductBundlesController } from './product-bundles.controller';
import { ProductBundlesService } from './product-bundles.service';

@Module({
  controllers: [ProductBundlesController, AdminProductBundlesController],
  providers: [ProductBundlesService],
})
export class ProductBundlesModule {}
