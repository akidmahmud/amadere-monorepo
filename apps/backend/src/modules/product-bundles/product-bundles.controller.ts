import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { ProductBundlesService } from './product-bundles.service';

@ApiTags('product-bundles')
@Controller('product-bundles')
export class ProductBundlesController {
  constructor(private readonly bundles: ProductBundlesService) {}

  @Get()
  list(
    @Query() { locale }: LocaleQueryDto,
    @Query() { page, pageSize }: PaginationQueryDto,
  ) {
    return this.bundles.publicList(locale ?? 'EN', page ?? 1, pageSize ?? 20);
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string, @Query() { locale }: LocaleQueryDto) {
    return this.bundles.publicGetBySlug(slug, locale ?? 'EN');
  }
}
