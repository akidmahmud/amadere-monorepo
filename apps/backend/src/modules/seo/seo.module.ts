import { Module } from '@nestjs/common';
import { AdminSeoController } from './admin-seo.controller';
import { SeoService } from './seo.service';

@Module({
  controllers: [AdminSeoController],
  providers: [SeoService],
  exports: [SeoService],
})
export class SeoModule {}
