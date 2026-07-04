import { Module } from '@nestjs/common';
import { SeoModule } from '../seo/seo.module';
import { BlogPostsController } from './blog-posts.controller';
import { AdminBlogPostsController } from './admin-blog-posts.controller';
import { BlogPostsService } from './blog-posts.service';

@Module({
  imports: [SeoModule],
  controllers: [BlogPostsController, AdminBlogPostsController],
  providers: [BlogPostsService],
})
export class BlogPostsModule {}
