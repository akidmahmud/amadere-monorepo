import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { PagesService } from './pages.service';
import { PublicPageDetailDto } from './pages.mapper';

@ApiTags('pages')
@Controller('pages')
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Get(':slug')
  @ApiOkResponse({ type: PublicPageDetailDto })
  getBySlug(
    @Param('slug') slug: string,
    @Query() { locale }: LocaleQueryDto,
  ): Promise<PublicPageDetailDto> {
    return this.pages.publicGetBySlug(slug, locale ?? 'EN');
  }
}
