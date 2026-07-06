import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginatedResult } from '@amader/shared';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
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
  getBySlug(
    @Param('slug') slug: string,
    @Query() { locale }: LocaleQueryDto,
  ): Promise<PublicBlogPostDetailDto> {
    return this.posts.publicGetBySlug(slug, locale ?? 'EN');
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
