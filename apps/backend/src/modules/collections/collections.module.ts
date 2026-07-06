import { Module } from '@nestjs/common';
import { SeoModule } from '../seo/seo.module';
import { AdminCollectionsController } from './admin-collections.controller';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';

@Module({
  imports: [SeoModule],
  controllers: [CollectionsController, AdminCollectionsController],
  providers: [CollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
