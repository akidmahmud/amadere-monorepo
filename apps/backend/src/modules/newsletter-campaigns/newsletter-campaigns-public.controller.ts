import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NewsletterCampaignsService } from './newsletter-campaigns.service';

// 1x1 transparent GIF, the standard open-tracking pixel payload.
const TRACKING_PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7', 'base64');

// Public, unauthenticated — a mail client loading an <img> or a recipient
// clicking a link has no admin session. Raw responses (@Res, bypassing the
// global {success,data} envelope) for the same reason sitemap.xml/robots.txt
// are raw: a browser/mail-client, not this app's own JSON API consumers, is
// on the other end. Excluded from Swagger — not part of the public API surface.
@ApiExcludeController()
@Controller('newsletter')
export class NewsletterCampaignsPublicController {
  constructor(
    private readonly campaigns: NewsletterCampaignsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('track/open/:token')
  async trackOpen(@Param('token') token: string, @Res() res: Response): Promise<void> {
    // Never let a broken/unknown token surface as an error — a missing
    // tracking pixel is just a blank image to the recipient either way.
    await this.campaigns.recordOpen(token).catch(() => undefined);
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store');
    res.send(TRACKING_PIXEL);
  }

  @Get('track/click/:token')
  async trackClick(@Param('token') token: string, @Query('url') url: string | undefined, @Res() res: Response): Promise<void> {
    await this.campaigns.recordClick(token).catch(() => undefined);
    const target = url && /^https?:\/\//.test(url) ? url : '/';
    res.redirect(302, target);
  }

  @Get('unsubscribe/:token')
  async unsubscribeByToken(@Param('token') token: string, @Res() res: Response): Promise<void> {
    const subscriber = await this.prisma.client.newsletterSubscriber.findUnique({ where: { unsubscribeToken: token } });
    if (subscriber && subscriber.status !== 'UNSUBSCRIBED') {
      await this.prisma.client.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() },
      });
    }
    // A minimal static confirmation page — this backend has no server-rendered
    // page system otherwise (the storefront is a separate Next.js app), and a
    // one-off unsubscribe confirmation doesn't warrant standing one up.
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#333;}</style>
</head><body><h2>You've been unsubscribed</h2><p>${subscriber ? `${subscriber.email} will no longer receive newsletter emails from us.` : "This link isn't valid, but you're not on our list either way."}</p></body></html>`);
  }
}
