import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { BlogTagsService } from './blog-tags.service';

@ApiTags('blog-tags')
@Controller('blog-tags')
export class BlogTagsController {
  constructor(private readonly tags: BlogTagsService) {}

  @Get()
  list(
    @Query() { locale }: LocaleQueryDto,
    @Query() { page, pageSize }: PaginationQueryDto,
  ) {
    return this.tags.publicList(locale ?? 'EN', page ?? 1, pageSize ?? 20);
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string, @Query() { locale }: LocaleQueryDto) {
    return this.tags.publicGetBySlug(slug, locale ?? 'EN');
  }
}
