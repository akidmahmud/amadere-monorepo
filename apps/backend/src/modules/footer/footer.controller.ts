import { Controller, Get, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { FooterService, PublicFooter } from './footer.service';
import { PublicFooterDto } from './footer.mapper';

// Public, read-only, fetched server-side on every single page load (the
// footer is in [locale]/layout.tsx) — same throttle exemption and for the
// same reason as SiteInfoController and AnnouncementsController.
@SkipThrottle()
@ApiTags('footer')
@Controller('footer')
export class FooterController {
  constructor(private readonly footer: FooterService) {}

  @Get()
  @ApiOkResponse({ type: PublicFooterDto })
  get(@Query() { locale }: LocaleQueryDto): Promise<PublicFooter> {
    return this.footer.getPublic(locale ?? 'EN');
  }
}
