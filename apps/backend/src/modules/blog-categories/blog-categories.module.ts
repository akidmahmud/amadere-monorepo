import { Module } from '@nestjs/common';
import { BlogCategoriesController } from './blog-categories.controller';
import { AdminBlogCategoriesController } from './admin-blog-categories.controller';
import { BlogCategoriesService } from './blog-categories.service';

@Module({
  controllers: [BlogCategoriesController, AdminBlogCategoriesController],
  providers: [BlogCategoriesService],
  exports: [BlogCategoriesService],
})
export class BlogCategoriesModule {}
