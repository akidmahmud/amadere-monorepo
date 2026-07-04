import { Module } from '@nestjs/common';
import { BlogTagsController } from './blog-tags.controller';
import { AdminBlogTagsController } from './admin-blog-tags.controller';
import { BlogTagsService } from './blog-tags.service';

@Module({
  controllers: [BlogTagsController, AdminBlogTagsController],
  providers: [BlogTagsService],
  exports: [BlogTagsService],
})
export class BlogTagsModule {}
