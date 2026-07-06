import { Module } from '@nestjs/common';
import { CollectionsModule } from '../collections/collections.module';
import { AdminHomepageSectionsController } from './admin-homepage-sections.controller';
import { HomepageSectionsController } from './homepage-sections.controller';
import { HomepageSectionsService } from './homepage-sections.service';

@Module({
  imports: [CollectionsModule],
  controllers: [HomepageSectionsController, AdminHomepageSectionsController],
  providers: [HomepageSectionsService],
})
export class HomepageSectionsModule {}
