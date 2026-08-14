import { Controller, Get, Param, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { PagesService } from './pages.service';
import { PublicPageDetailDto } from './pages.mapper';

// Public, read-only CMS content, called server-side on every static-page
// render (see apps/web's catch-all route) — not an abuse target, and the
// global ThrottlerGuard's shared per-IP bucket otherwise gets exhausted by
// normal SSR traffic alone.
@SkipThrottle()
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
