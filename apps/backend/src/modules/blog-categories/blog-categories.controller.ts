import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { BlogCategoriesService } from './blog-categories.service';

@ApiTags('blog-categories')
@Controller('blog-categories')
export class BlogCategoriesController {
  constructor(private readonly categories: BlogCategoriesService) {}

  @Get()
  @ApiQuery({ name: 'parentId', required: false, type: Number })
  list(
    @Query() { locale }: LocaleQueryDto,
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('parentId') parentId?: string,
  ) {
    return this.categories.publicList(
      locale ?? 'EN',
      page ?? 1,
      pageSize ?? 20,
      parentId ? Number(parentId) : undefined,
    );
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string, @Query() { locale }: LocaleQueryDto) {
    return this.categories.publicGetBySlug(slug, locale ?? 'EN');
  }
}
