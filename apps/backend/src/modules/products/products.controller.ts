import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { ProductFilterQueryDto } from './dto/product-filter-query.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(
    @Query() { locale }: LocaleQueryDto,
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query() filters: ProductFilterQueryDto,
  ) {
    return this.products.publicList(
      locale ?? 'EN',
      page ?? 1,
      pageSize ?? 20,
      filters,
    );
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string, @Query() { locale }: LocaleQueryDto) {
    return this.products.publicGetBySlug(slug, locale ?? 'EN');
  }
}
