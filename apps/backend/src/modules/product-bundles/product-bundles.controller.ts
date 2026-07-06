import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginatedResult } from '@amader/shared';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { ProductBundlesService } from './product-bundles.service';
import {
  PublicBundleDetailDto,
  PublicBundleDto,
} from './product-bundles.mapper';

@ApiTags('product-bundles')
@Controller('product-bundles')
export class ProductBundlesController {
  constructor(private readonly bundles: ProductBundlesService) {}

  @Get()
  @ApiQuery({
    name: 'productId',
    required: false,
    type: Number,
    description: 'Only bundles that include this product — powers PDP "combo suggestions".',
  })
  @ApiPaginatedResponse(PublicBundleDto)
  list(
    @Query() { locale }: LocaleQueryDto,
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('productId') productId?: string,
  ): Promise<PaginatedResult<PublicBundleDto>> {
    return this.bundles.publicList(
      locale ?? 'EN',
      page ?? 1,
      pageSize ?? 20,
      productId ? Number(productId) : undefined,
    );
  }

  @Get(':slug')
  @ApiOkResponse({ type: PublicBundleDetailDto })
  getBySlug(
    @Param('slug') slug: string,
    @Query() { locale }: LocaleQueryDto,
  ): Promise<PublicBundleDetailDto> {
    return this.bundles.publicGetBySlug(slug, locale ?? 'EN');
  }
}
