import { Module } from '@nestjs/common';
import { SeoModule } from '../seo/seo.module';
import { AdminTagsController } from './admin-tags.controller';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

@Module({
  imports: [SeoModule],
  controllers: [TagsController, AdminTagsController],
  providers: [TagsService],
})
export class TagsModule {}
