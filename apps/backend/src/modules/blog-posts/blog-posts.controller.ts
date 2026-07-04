import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { BlogPostsService } from './blog-posts.service';

@ApiTags('blog-posts')
@Controller()
export class BlogPostsController {
  constructor(private readonly posts: BlogPostsService) {}

  @Get('blog-posts')
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'tag', required: false })
  list(
    @Query() { locale }: LocaleQueryDto,
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('category') category?: string,
    @Query('tag') tag?: string,
  ) {
    return this.posts.publicList(
      locale ?? 'EN',
      page ?? 1,
      pageSize ?? 20,
      category,
      tag,
    );
  }

  @Get('blog-posts/:slug')
  getBySlug(@Param('slug') slug: string, @Query() { locale }: LocaleQueryDto) {
    return this.posts.publicGetBySlug(slug, locale ?? 'EN');
  }

  @Get('blog-authors/:id')
  authorProfile(
    @Param('id', ParseIntPipe) id: number,
    @Query() { locale }: LocaleQueryDto,
    @Query() { page, pageSize }: PaginationQueryDto,
  ) {
    return this.posts.authorProfile(
      id,
      locale ?? 'EN',
      page ?? 1,
      pageSize ?? 20,
    );
  }
}
