import { Module } from '@nestjs/common';
import { SeoModule } from '../seo/seo.module';
import { AdminProductBundlesController } from './admin-product-bundles.controller';
import { ProductBundlesController } from './product-bundles.controller';
import { ProductBundlesService } from './product-bundles.service';

@Module({
  imports: [SeoModule],
  controllers: [ProductBundlesController, AdminProductBundlesController],
  providers: [ProductBundlesService],
})
export class ProductBundlesModule {}
