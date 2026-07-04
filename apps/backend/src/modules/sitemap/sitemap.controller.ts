import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { SitemapService } from './sitemap.service';

// Excluded from Swagger and from the global response envelope (raw XML/text,
// not {success,data} JSON) — search engines expect these at conventional
// paths, so main.ts also excludes them from the /api/v1 prefix.
@ApiExcludeController()
@Controller()
export class SitemapController {
  constructor(private readonly sitemap: SitemapService) {}

  @Get('sitemap.xml')
  async sitemapXml(@Res() res: Response) {
    const xml = await this.sitemap.buildXml();
    res.type('application/xml').send(xml);
  }

  @Get('robots.txt')
  robotsTxt(@Res() res: Response) {
    res.type('text/plain').send(this.sitemap.buildRobotsTxt());
  }
}
