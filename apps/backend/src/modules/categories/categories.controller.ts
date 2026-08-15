import { Controller, Get, Param, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginatedResult } from '@amader/shared';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { CategoriesService } from './categories.service';
import {
  PublicCategoryDetailDto,
  PublicCategoryDto,
  PublicCategoryNavDto,
} from './categories.mapper';

// Public, read-only, called server-side on every storefront page render
// (the nav's category dropdown) and every category page — see
// SiteInfoController's comment for why this is exempt from the global
// per-IP throttle.
@SkipThrottle()
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

  @Get('nav')
  @ApiOkResponse({ type: PublicCategoryNavDto, isArray: true })
  navList(@Query() { locale }: LocaleQueryDto): Promise<PublicCategoryNavDto[]> {
    return this.categories.publicNavList(locale ?? 'EN');
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
