import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { BrandsService } from './brands.service';

@ApiTags('brands')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  list(
    @Query() { locale }: LocaleQueryDto,
    @Query() { page, pageSize }: PaginationQueryDto,
  ) {
    return this.brands.publicList(locale ?? 'EN', page ?? 1, pageSize ?? 20);
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string, @Query() { locale }: LocaleQueryDto) {
    return this.brands.publicGetBySlug(slug, locale ?? 'EN');
  }
}
