import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { BkashCallbackService } from './bkash-callback.service';
import { BkashSettingsService } from './bkash-settings.service';

// Where bKash sends the customer back after their hosted checkout page. Not
// an API a client calls — it is a browser redirect target, so it answers with
// a 302 back to the storefront rather than JSON, and never throws: a customer
// stranded on a blank error page has no idea whether their money moved.
@ApiTags('payments')
@Controller('payments/bkash')
export class BkashCallbackController {
  private readonly logger = new Logger(BkashCallbackController.name);

  constructor(
    private readonly callback: BkashCallbackService,
    private readonly settings: BkashSettingsService,
    private readonly config: ConfigService,
  ) {}

  // Public, unauthenticated: checkout asks whether bKash is on before it can
  // offer it. Returns null (not 404) when the gateway is off, so the
  // storefront has one shape to handle either way. No secrets here.
  @Get('config')
  publicConfig() {
    return this.settings.getPublicConfig();
  }

  @Get('callback')
  @ApiExcludeEndpoint()
  async handle(
    @Query('paymentID') paymentID: string | undefined,
    @Query('status') status: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const storefront =
      this.config.get<string>('STOREFRONT_BASE_URL') ?? 'http://localhost:3001';
    let outcome: { ok: boolean; orderNumber?: string } = { ok: false };
    try {
      outcome = await this.callback.settle(paymentID, status);
    } catch (err) {
      // Swallowed on purpose — see the class comment. The payment row keeps
      // whatever state it had, so a failed settle is recoverable by an admin
      // rather than lost.
      this.logger.error(
        `bKash callback failed for paymentID=${paymentID ?? 'none'}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    const params = new URLSearchParams({
      bkash: outcome.ok ? 'success' : 'failed',
    });
    if (outcome.orderNumber) params.set('order', outcome.orderNumber);
    // Handed back only on failure, and only so the storefront can call
    // /orders/restore-cart with it: that puts the abandoned order's lines
    // back in the customer's cart and cancels the order, instead of leaving
    // them on an empty checkout with an orphan PENDING order behind them.
    if (!outcome.ok && paymentID) params.set('paymentID', paymentID);
    res.redirect(`${storefront}/checkout?${params.toString()}`);
  }
}
