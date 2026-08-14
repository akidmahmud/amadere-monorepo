import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { SiteInfoDto } from './settings.mapper';

// Public, read-only, and hit server-side on every single page load (the
// storefront's root layout fetches this for every request) — the global
// ThrottlerGuard's per-IP bucket is meant for abuse-prone endpoints, not
// content every visitor's page render depends on.
@SkipThrottle()
@ApiTags('settings')
@Controller('settings')
export class SiteInfoController {
  constructor(private readonly settings: SettingsService) {}

  @Get('site')
  @ApiOkResponse({ type: SiteInfoDto })
  getSiteInfo(): Promise<SiteInfoDto> {
    return this.settings.getSiteInfo();
  }
}
