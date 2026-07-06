import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginatedResult } from '@amader/shared';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { CategoriesService } from './categories.service';
import {
  PublicCategoryDetailDto,
  PublicCategoryDto,
} from './categories.mapper';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiQuery({ name: 'parentId', required: false, type: Number })
  @ApiPaginatedResponse(PublicCategoryDto)
  list(
    @Query() { locale }: LocaleQueryDto,
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('parentId') parentId?: string,
  ): Promise<PaginatedResult<PublicCategoryDto>> {
    return this.categories.publicList(
      locale ?? 'EN',
      page ?? 1,
      pageSize ?? 20,
      parentId ? Number(parentId) : undefined,
    );
  }

  @Get(':slug')
  @ApiOkResponse({ type: PublicCategoryDetailDto })
  getBySlug(
    @Param('slug') slug: string,
    @Query() { locale }: LocaleQueryDto,
  ): Promise<PublicCategoryDetailDto> {
    return this.categories.publicGetBySlug(slug, locale ?? 'EN');
  }
}
