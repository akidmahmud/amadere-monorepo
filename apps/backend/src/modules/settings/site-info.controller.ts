import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { SiteInfoDto } from './settings.mapper';

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
