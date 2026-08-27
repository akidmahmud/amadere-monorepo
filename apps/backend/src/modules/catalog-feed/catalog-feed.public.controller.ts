import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CatalogFeedService } from './catalog-feed.service';
import {
  toGoogleXml,
  toMetaJson,
  toTiktokTsv,
} from './catalog-feed.formatters';

/** 30 minutes, as specified in the brief. */
const CACHE_CONTROL = 'public, max-age=1800';

/**
 * The three public catalog feeds.
 *
 * Deliberately unauthenticated: Meta, Google and TikTok fetch these from
 * their own infrastructure on their own schedule and have nowhere to put a
 * credential. Everything served here is already public on the storefront —
 * name, price, stock and image of a PUBLISHED product.
 *
 * `@Res()` rather than a returned object, because the global
 * ResponseInterceptor wraps every handler's return value in
 * `{ success, data }`. That is right for the JSON API and fatal here: Google
 * would receive a JSON envelope where it expects an XML document.
 */
@ApiTags('catalog-feed')
@Controller('feed')
export class CatalogFeedPublicController {
  constructor(private readonly feed: CatalogFeedService) {}

  @Get('meta')
  @ApiExcludeEndpoint()
  async meta(@Res() res: Response): Promise<void> {
    const { items } = await this.feed.get();
    res
      .type('application/json')
      .set('Cache-Control', CACHE_CONTROL)
      .send(toMetaJson(items));
  }

  @Get('google')
  @ApiExcludeEndpoint()
  async google(@Res() res: Response): Promise<void> {
    const { items } = await this.feed.get();
    res
      .type('application/xml')
      .set('Cache-Control', CACHE_CONTROL)
      .send(toGoogleXml(items, this.feed.shopUrl));
  }

  @Get('tiktok')
  @ApiExcludeEndpoint()
  async tiktok(@Res() res: Response): Promise<void> {
    const { items } = await this.feed.get();
    res
      .type('text/tab-separated-values')
      .set('Cache-Control', CACHE_CONTROL)
      .send(toTiktokTsv(items));
  }
}
