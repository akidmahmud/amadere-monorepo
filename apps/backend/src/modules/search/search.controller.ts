import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { SEARCH_PROVIDER } from './search-provider.interface';
import type { SearchProvider } from './search-provider.interface';
import { SearchQueryDto } from './dto/search-query.dto';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(
    @Inject(SEARCH_PROVIDER) private readonly search: SearchProvider,
  ) {}

  @Get('products')
  searchProducts(
    @Query() { q }: SearchQueryDto,
    @Query() { locale }: LocaleQueryDto,
    @Query() { page, pageSize }: PaginationQueryDto,
  ) {
    return this.search.searchProducts(
      q,
      locale ?? 'EN',
      page ?? 1,
      pageSize ?? 20,
    );
  }
}
