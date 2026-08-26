import { Controller, Get, Param, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
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

  // Declared BEFORE ':slug': Nest matches routes in declaration order, so the
  // parameterised route would otherwise swallow this and look for a page
  // whose slug is literally "checkout-layout".
  @Get('checkout-layout')
  @ApiOkResponse({ description: 'Active checkout layout, or null.' })
  checkoutLayout(
    @Query() { locale }: LocaleQueryDto,
  ): Promise<{ layout: unknown | null }> {
    return this.pages.getActiveCheckoutLayout(locale ?? 'EN');
  }

  @Get(':slug')
  // Without this the generated OpenAPI marks previewToken as REQUIRED, and
  // every ordinary caller stops type-checking. Same declaration the blog
  // controller carries for its own preview token.
  @ApiQuery({ name: 'previewToken', required: false })
  @ApiOkResponse({ type: PublicPageDetailDto })
  getBySlug(
    @Param('slug') slug: string,
    @Query() { locale }: LocaleQueryDto,
    @Query('previewToken') previewToken?: string,
  ): Promise<PublicPageDetailDto> {
    return this.pages.publicGetBySlug(slug, locale ?? 'EN', previewToken);
  }
}
