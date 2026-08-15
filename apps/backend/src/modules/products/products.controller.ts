import { Controller, Get, Param, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginatedResult } from '@amader/shared';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { ProductFilterQueryDto } from './dto/product-filter-query.dto';
import { ProductsService } from './products.service';
import {
  PublicProductDetailDto,
  PublicProductDto,
} from './dto/product-response.dto';

// Public, read-only, called server-side on every storefront product-listing
// and product-detail page render — see SiteInfoController's comment for why
// this is exempt from the global per-IP throttle.
@SkipThrottle()
@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiPaginatedResponse(PublicProductDto)
  list(
    @Query() { locale }: LocaleQueryDto,
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query() filters: ProductFilterQueryDto,
  ): Promise<PaginatedResult<PublicProductDto>> {
    return this.products.publicList(
      locale ?? 'EN',
      page ?? 1,
      pageSize ?? 20,
      filters,
    );
  }

  @Get(':slug')
  @ApiOkResponse({ type: PublicProductDetailDto })
  @ApiQuery({ name: 'previewToken', required: false })
  getBySlug(
    @Param('slug') slug: string,
    @Query() { locale }: LocaleQueryDto,
    @Query('previewToken') previewToken?: string,
  ): Promise<PublicProductDetailDto> {
    return this.products.publicGetBySlug(slug, locale ?? 'EN', previewToken);
  }
}
