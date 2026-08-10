import { Module } from '@nestjs/common';
import { SeoModule } from '../seo/seo.module';
import { PromoVideosController } from './promo-videos.controller';
import { AdminPromoVideosController } from './admin-promo-videos.controller';
import { PromoVideosService } from './promo-videos.service';

@Module({
  imports: [SeoModule],
  controllers: [PromoVideosController, AdminPromoVideosController],
  providers: [PromoVideosService],
  exports: [PromoVideosService],
})
export class PromoVideosModule {}
