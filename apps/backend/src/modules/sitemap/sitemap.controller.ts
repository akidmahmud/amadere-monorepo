import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { SitemapService } from './sitemap.service';
import { SitemapSettingsService } from './sitemap-settings.service';

// Excluded from Swagger and from the global response envelope (raw XML/text,
// not {success,data} JSON) — search engines expect these at conventional
// paths, so main.ts also excludes them from the /api/v1 prefix.
@ApiExcludeController()
@Controller()
export class SitemapController {
  constructor(
    private readonly sitemap: SitemapService,
    private readonly settings: SitemapSettingsService,
  ) {}

  @Get('sitemap.xml')
  async sitemapXml(@Res() res: Response) {
    const settings = await this.settings.getSettings();
    if (!settings.enabled) {
      res.status(404).type('text/plain').send('Sitemap is disabled');
      return;
    }
    const xml = await this.sitemap.buildXml();
    res.type('application/xml').send(xml);
  }

  @Get('robots.txt')
  robotsTxt(@Res() res: Response) {
    res.type('text/plain').send(this.sitemap.buildRobotsTxt());
  }

  // IndexNow domain-ownership verification file — must be declared after
  // the literal 'robots.txt' route above, since ':key.txt' would otherwise
  // also match it (Nest/Express resolve routes in declaration order).
  @Get(':key.txt')
  async indexNowKeyFile(@Param('key') key: string, @Res() res: Response) {
    const match = await this.settings.getIndexNowKeyIfMatches(key);
    if (!match) {
      res.status(404).type('text/plain').send('Not found');
      return;
    }
    res.type('text/plain').send(match);
  }
}
