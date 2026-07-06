import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginatedResult } from '@amader/shared';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { BlogCategoriesService } from './blog-categories.service';
import {
  PublicBlogCategoryDetailDto,
  PublicBlogCategoryDto,
} from './blog-categories.mapper';

@ApiTags('blog-categories')
@Controller('blog-categories')
export class BlogCategoriesController {
  constructor(private readonly categories: BlogCategoriesService) {}

  @Get()
  @ApiQuery({ name: 'parentId', required: false, type: Number })
  @ApiPaginatedResponse(PublicBlogCategoryDto)
  list(
    @Query() { locale }: LocaleQueryDto,
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('parentId') parentId?: string,
  ): Promise<PaginatedResult<PublicBlogCategoryDto>> {
    return this.categories.publicList(
      locale ?? 'EN',
      page ?? 1,
      pageSize ?? 20,
      parentId ? Number(parentId) : undefined,
    );
  }

  @Get(':slug')
  @ApiOkResponse({ type: PublicBlogCategoryDetailDto })
  getBySlug(
    @Param('slug') slug: string,
    @Query() { locale }: LocaleQueryDto,
  ): Promise<PublicBlogCategoryDetailDto> {
    return this.categories.publicGetBySlug(slug, locale ?? 'EN');
  }
}
