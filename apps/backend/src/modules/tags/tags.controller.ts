import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaginatedResult } from '@amader/shared';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { TagsService } from './tags.service';
import { PublicTagDetailDto, PublicTagDto } from './tags.mapper';

@ApiTags('tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @ApiPaginatedResponse(PublicTagDto)
  list(
    @Query() { locale }: LocaleQueryDto,
    @Query() { page, pageSize }: PaginationQueryDto,
  ): Promise<PaginatedResult<PublicTagDto>> {
    return this.tags.publicList(locale ?? 'EN', page ?? 1, pageSize ?? 20);
  }

  @Get(':slug')
  @ApiOkResponse({ type: PublicTagDetailDto })
  getBySlug(
    @Param('slug') slug: string,
    @Query() { locale }: LocaleQueryDto,
  ): Promise<PublicTagDetailDto> {
    return this.tags.publicGetBySlug(slug, locale ?? 'EN');
  }
}
