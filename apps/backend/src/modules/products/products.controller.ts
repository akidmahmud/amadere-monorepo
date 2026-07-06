import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
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
  getBySlug(
    @Param('slug') slug: string,
    @Query() { locale }: LocaleQueryDto,
  ): Promise<PublicProductDetailDto> {
    return this.products.publicGetBySlug(slug, locale ?? 'EN');
  }
}
