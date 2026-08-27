import { Body, Controller, Ip, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { CartIdentityGuard } from '../cart/cart-identity.guard';
import type { RequestWithCartIdentity } from '../cart/cart-identity.guard';
import { CheckoutService } from './checkout.service';
import type { CheckoutResultDto } from './checkout.service';
import { CheckoutDto } from './dto/checkout.dto';
import { RequestCodOtpDto } from './dto/request-cod-otp.dto';
import { CheckoutAbandonmentDto } from './dto/checkout-abandonment.dto';
import { OrderDto } from './orders.mapper';

@ApiTags('checkout')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Guest-Token', required: false })
@UseGuards(CartIdentityGuard)
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post('cod-otp/request')
  requestCodOtp(
    @Req() req: RequestWithCartIdentity,
    @Body() dto: RequestCodOtpDto,
    @Ip() ip: string,
  ): Promise<void> {
    return this.checkout.requestCodOtp(req.cartIdentity, dto, ip);
  }

  /**
   * Fired by the checkout form once the shopper has entered contact details.
   *
   * Deliberately its own endpoint rather than a flag on some other call: it
   * fires while the shopper is still typing, long before there is anything to
   * validate or charge, and it must never be able to fail a real request.
   */
  @Post('abandonment')
  recordAbandonment(
    @Req() req: RequestWithCartIdentity,
    @Body() dto: CheckoutAbandonmentDto,
  ): Promise<void> {
    return this.checkout.recordAbandonment(req.cartIdentity, dto);
  }

  @Post()
  // Response shape is OrderDto plus two fields present only for a
  // digital-only, no-session checkout (see CheckoutResultDto) — swagger
  // still documents it as OrderDto since ApiOkResponse needs a decorated
  // class, not this plain intersection type.
  @ApiOkResponse({ type: OrderDto })
  placeOrder(
    @Req() req: RequestWithCartIdentity,
    @Body() dto: CheckoutDto,
    @Query() { locale }: LocaleQueryDto,
  ): Promise<CheckoutResultDto> {
    return this.checkout.checkout(req.cartIdentity, dto, locale ?? 'EN', req.ip);
  }
}
