import { Module } from '@nestjs/common';
import { SeoModule } from '../seo/seo.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { AdminProductsController } from './admin-products.controller';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [SeoModule, ReviewsModule],
  controllers: [ProductsController, AdminProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
