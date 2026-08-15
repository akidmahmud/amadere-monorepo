import { Controller, Get, Param, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaginatedResult } from '@amader/shared';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { BlogTagsService } from './blog-tags.service';
import { PublicBlogTagDto } from './blog-tags.mapper';

// Public, read-only — see SiteInfoController's comment for why this is
// exempt from the global per-IP throttle.
@SkipThrottle()
@ApiTags('blog-tags')
@Controller('blog-tags')
export class BlogTagsController {
  constructor(private readonly tags: BlogTagsService) {}

  @Get()
  @ApiPaginatedResponse(PublicBlogTagDto)
  list(
    @Query() { locale }: LocaleQueryDto,
    @Query() { page, pageSize }: PaginationQueryDto,
  ): Promise<PaginatedResult<PublicBlogTagDto>> {
    return this.tags.publicList(locale ?? 'EN', page ?? 1, pageSize ?? 20);
  }

  @Get(':slug')
  @ApiOkResponse({ type: PublicBlogTagDto })
  getBySlug(
    @Param('slug') slug: string,
    @Query() { locale }: LocaleQueryDto,
  ): Promise<PublicBlogTagDto> {
    return this.tags.publicGetBySlug(slug, locale ?? 'EN');
  }
}
