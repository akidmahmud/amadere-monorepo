import { Controller, Get, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { MenusService } from './menus.service';
import { PublicMenuItemDto } from './menus.mapper';

// Public, read-only, fetched server-side on every single page load (root
// layout's nav menu) — see SiteInfoController's comment for why this is
// exempt from the global per-IP throttle.
@SkipThrottle()
@ApiTags('menu')
@Controller('menu')
export class MenuController {
  constructor(private readonly menus: MenusService) {}

  @Get()
  @ApiOkResponse({ type: PublicMenuItemDto, isArray: true })
  getTree(@Query() { locale }: LocaleQueryDto): Promise<PublicMenuItemDto[]> {
    return this.menus.publicTree(locale ?? 'EN');
  }
}
