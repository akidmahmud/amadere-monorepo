import { Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PaginatedResult } from '@amader/shared';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { SuccessResponseDto } from '../../common/dto/success-response.dto';
import { BlogPostsService } from './blog-posts.service';
import {
  BlogAuthorProfileDto,
  PublicBlogPostDetailDto,
  PublicBlogPostSummaryDto,
} from './blog-posts.mapper';

@ApiTags('blog-posts')
@Controller()
export class BlogPostsController {
  constructor(private readonly posts: BlogPostsService) {}

  @Get('blog-posts')
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'tag', required: false })
  @ApiPaginatedResponse(PublicBlogPostSummaryDto)
  list(
    @Query() { locale }: LocaleQueryDto,
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('category') category?: string,
    @Query('tag') tag?: string,
  ): Promise<PaginatedResult<PublicBlogPostSummaryDto>> {
    return this.posts.publicList(
      locale ?? 'EN',
      page ?? 1,
      pageSize ?? 20,
      category,
      tag,
    );
  }

  @Get('blog-posts/:slug')
  @ApiOkResponse({ type: PublicBlogPostDetailDto })
  @ApiQuery({ name: 'previewToken', required: false })
  getBySlug(
    @Param('slug') slug: string,
    @Query() { locale }: LocaleQueryDto,
    @Query('previewToken') previewToken?: string,
  ): Promise<PublicBlogPostDetailDto> {
    return this.posts.publicGetBySlug(slug, locale ?? 'EN', previewToken);
  }

  // Public + unauthenticated (anonymous storefront readers) — throttled
  // tighter than the global 120/min default since it's trivial to script,
  // and a fake-inflated view count is the only thing at stake, not data
  // integrity. Dedup (one count per visitor per post) happens client-side
  // via a cookie in apps/web's BlogViewTracker, not here.
  @Post('blog-posts/:slug/view')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOkResponse({ type: SuccessResponseDto })
  async recordView(@Param('slug') slug: string): Promise<SuccessResponseDto> {
    await this.posts.recordView(slug);
    return { success: true };
  }

  @Get('blog-authors/:id')
  @ApiOkResponse({ type: BlogAuthorProfileDto })
  authorProfile(
    @Param('id', ParseIntPipe) id: number,
    @Query() { locale }: LocaleQueryDto,
    @Query() { page, pageSize }: PaginationQueryDto,
  ): Promise<BlogAuthorProfileDto> {
    return this.posts.authorProfile(
      id,
      locale ?? 'EN',
      page ?? 1,
      pageSize ?? 20,
    );
  }
}
