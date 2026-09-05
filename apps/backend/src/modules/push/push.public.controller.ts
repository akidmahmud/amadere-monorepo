import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PushService } from './push.service';
import { RegisterStockAlertDto, SubscribePushDto, UnsubscribePushDto } from './dto/push.dto';
import { StockAlertsService } from './stock-alerts.service';

/**
 * Storefront-facing. Three endpoints, all a browser can reach unauthenticated —
 * an anonymous visitor is allowed to opt in, and gets linked to a customer
 * later if they log in.
 *
 * Nothing here can be used to SEND anything. Sending lives behind the admin
 * guard and the campaign engine.
 */
@ApiTags('push')
@Controller('push')
export class PushPublicController {
  constructor(
    private readonly push: PushService,
    private readonly stockAlerts: StockAlertsService,
  ) {}

  /** The browser needs this before it can call pushManager.subscribe(). */
  @Get('public-key')
  async publicKey(): Promise<{ publicKey: string | null }> {
    return { publicKey: await this.push.getPublicKey() };
  }

  // Rate-limited like the fraud pre-flight: a subscribe is cheap but it writes,
  // and this endpoint is open.
  @Post('subscribe')
  @Throttle({ default: { limit: 12, ttl: 60000 } })
  async subscribe(
    @Body() dto: SubscribePushDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<{ ok: true }> {
    await this.push.subscribe({
      endpoint: dto.endpoint,
      p256dh: dto.p256dh,
      auth: dto.auth,
      customerId: dto.customerId ?? null,
      guestToken: dto.guestToken ?? null,
      userAgent: userAgent ?? null,
      locale: dto.locale === 'BN' ? 'BN' : 'EN',
    });
    return { ok: true };
  }

  @Post('unsubscribe')
  @Throttle({ default: { limit: 12, ttl: 60000 } })
  async unsubscribe(@Body() dto: UnsubscribePushDto): Promise<{ ok: true }> {
    await this.push.unsubscribe(dto.endpoint);
    return { ok: true };
  }

  /**
   * "Tell me when this is back."
   *
   * Takes the browser's push endpoint rather than an account, because the
   * shopper looking at a sold-out product usually is not logged in — and
   * requiring a login here would lose most of the people the feature exists for.
   */
  @Post('stock-alerts')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async registerStockAlert(@Body() dto: RegisterStockAlertDto): Promise<{ ok: true }> {
    return this.stockAlerts.register({
      productId: dto.productId,
      variantId: dto.variantId ?? null,
      endpoint: dto.endpoint,
      locale: dto.locale,
    });
  }
}
