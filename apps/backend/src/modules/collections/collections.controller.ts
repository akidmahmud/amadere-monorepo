import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaginatedResult } from '@amader/shared';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { CollectionsService } from './collections.service';
import {
  PublicCollectionDetailDto,
  PublicCollectionSummaryDto,
} from './collections.mapper';

@ApiTags('collections')
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  @ApiPaginatedResponse(PublicCollectionSummaryDto)
  list(
    @Query() { locale }: LocaleQueryDto,
    @Query() { page, pageSize }: PaginationQueryDto,
  ): Promise<PaginatedResult<PublicCollectionSummaryDto>> {
    return this.collections.publicList(locale ?? 'EN', page ?? 1, pageSize ?? 20);
  }

  @Get(':slug')
  @ApiOkResponse({ type: PublicCollectionDetailDto })
  getBySlug(
    @Param('slug') slug: string,
    @Query() { locale }: LocaleQueryDto,
  ): Promise<PublicCollectionDetailDto> {
    return this.collections.publicGetBySlug(slug, locale ?? 'EN');
  }
}
